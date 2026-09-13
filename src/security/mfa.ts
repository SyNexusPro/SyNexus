import type { User } from "@supabase/supabase-js";
import { GOOGLE_PLAY_REVIEW_EMAIL } from "../config/googlePlayReview";
import { isEmailVerified } from "../lib/emailVerification";
import { supabase } from "../lib/supabaseClient";
import { recordSecurityEvent } from "./securityEvents";

export const MFA_SETUP_PATH = "/security/setup";
export const MFA_VERIFY_PATH = "/security/verify";
export const SECURITY_SETTINGS_PATH = "/security";

export type AssuranceLevel = "aal1" | "aal2";

export type MfaContinue =
  | { action: "ok" }
  | { action: "setup"; path: typeof MFA_SETUP_PATH }
  | { action: "verify"; path: typeof MFA_VERIFY_PATH }
  | { action: "unsigned" };

const VERIFY_COOLDOWN_MS = 1400;
let lastVerifyAt = 0;

export function isMfaPolicyExemptEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase() ?? "";
  return value === GOOGLE_PLAY_REVIEW_EMAIL;
}

export function isMfaVerifyBusy(): boolean {
  return Date.now() - lastVerifyAt < VERIFY_COOLDOWN_MS;
}

function markVerifyAttempt(): void {
  lastVerifyAt = Date.now();
}

export async function getAssurance(): Promise<{
  currentLevel: AssuranceLevel;
  nextLevel: AssuranceLevel;
}> {
  if (!supabase) {
    return { currentLevel: "aal1", nextLevel: "aal1" };
  }
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    return { currentLevel: "aal1", nextLevel: "aal1" };
  }
  return {
    currentLevel: (data.currentLevel ?? "aal1") as AssuranceLevel,
    nextLevel: (data.nextLevel ?? "aal1") as AssuranceLevel,
  };
}

export async function getVerifiedSessionUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;
  return data.session.user;
}

export async function resolveMfaContinue(user?: User | null): Promise<MfaContinue> {
  const sessionUser = user === undefined ? await getVerifiedSessionUser() : user;
  if (!sessionUser) return { action: "unsigned" };
  if (isMfaPolicyExemptEmail(sessionUser.email)) return { action: "ok" };

  const { currentLevel, nextLevel } = await getAssurance();
  if (currentLevel === "aal2") return { action: "ok" };
  if (nextLevel === "aal2") return { action: "verify", path: MFA_VERIFY_PATH };
  return { action: "setup", path: MFA_SETUP_PATH };
}

/** After password / OAuth / biometric session is established. */
export async function continueMfaAfterAuth(): Promise<string | null> {
  const next = await resolveMfaContinue();
  if (next.action === "setup" || next.action === "verify") return next.path;
  return null;
}

export async function sessionSatisfiesProtectedAccess(): Promise<boolean> {
  const user = await getVerifiedSessionUser();
  if (!user) return false;
  if (!isEmailVerified(user)) return false;
  if (isMfaPolicyExemptEmail(user.email)) return true;
  const { currentLevel } = await getAssurance();
  return currentLevel === "aal2";
}

export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export async function enrollTotpFactor(friendlyName: string): Promise<TotpEnrollment> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error || !data) {
    throw new Error("Could not start authenticator setup. Try again.");
  }
  const totp = data.totp;
  if (!totp?.qr_code || !totp.secret) {
    throw new Error("Could not start authenticator setup. Try again.");
  }
  return {
    factorId: data.id,
    qrCode: totp.qr_code,
    secret: totp.secret,
  };
}

export async function verifyTotpCode(factorId: string, code: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (isMfaVerifyBusy()) {
    throw new Error("Wait a moment before trying again.");
  }
  markVerifyAttempt();
  const digits = code.replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) {
    throw new Error("Enter the 6-digit code from your authenticator app.");
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    void recordSecurityEvent({ eventType: "mfa_failure", success: false });
    throw new Error("Verification failed. Try again.");
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: digits,
  });
  if (verifyError) {
    void recordSecurityEvent({ eventType: "mfa_failure", success: false });
    throw new Error("That code didn't work. Try again.");
  }

  const { currentLevel } = await getAssurance();
  if (currentLevel !== "aal2") {
    void recordSecurityEvent({ eventType: "mfa_failure", success: false });
    throw new Error("Verification did not finish. Try again.");
  }
  markRecentStepUp();
}

export type ListedFactor = {
  id: string;
  friendlyName: string;
  status: string;
  factorType: string;
};

export async function listVerifiedTotpFactors(): Promise<ListedFactor[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return [];
  return (data.totp ?? [])
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name || "Authenticator",
      status: factor.status,
      factorType: factor.factor_type,
    }));
}

export async function unenrollFactor(factorId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const factors = await listVerifiedTotpFactors();
  if (factors.length <= 1) {
    throw new Error("You cannot remove your last authenticator.");
  }
  const { currentLevel } = await getAssurance();
  if (currentLevel !== "aal2" || !hasRecentStepUp()) {
    throw new Error("Confirm it's you, then try again.");
  }
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error("Could not remove that authenticator.");
  void recordSecurityEvent({ eventType: "mfa_removed", success: true });
}

const STEP_UP_KEY = "synexus_aal2_at";
const STEP_UP_MS = 15 * 60 * 1000;

export function markRecentStepUp(): void {
  try {
    sessionStorage.setItem(STEP_UP_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function hasRecentStepUp(): boolean {
  try {
    const raw = sessionStorage.getItem(STEP_UP_KEY);
    const at = raw ? Number(raw) : 0;
    return Number.isFinite(at) && Date.now() - at < STEP_UP_MS;
  } catch {
    return false;
  }
}

export function clearStepUp(): void {
  try {
    sessionStorage.removeItem(STEP_UP_KEY);
  } catch {
    /* ignore */
  }
}

export async function requireRecentAal2(): Promise<boolean> {
  const ok = await sessionSatisfiesProtectedAccess();
  return ok && hasRecentStepUp();
}
