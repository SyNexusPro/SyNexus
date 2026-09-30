import type { User } from "@supabase/supabase-js";
import { isAlwaysOnLoginEmail } from "../config/googlePlayReview";
import { isEmailVerified } from "../lib/emailVerification";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";
import { supabase } from "../lib/supabaseClient";
import { getFreshAuthUser, isPhoneVerified } from "./phoneVerification";
import { recordSecurityEvent } from "./securityEvents";

export const MFA_SETUP_PATH = "/security/setup";
export const MFA_VERIFY_PATH = "/security/verify";
export const SECURITY_SETTINGS_PATH = "/security";

export type AssuranceLevel = "aal1" | "aal2";

export type MfaContinue =
  | { action: "ok" }
  | { action: "setup"; path: string }
  | { action: "verify"; path: string }
  | { action: "unsigned" };

const VERIFY_COOLDOWN_MS = 1400;
let lastVerifyAt = 0;
const MFA_RESOLUTION_CACHE_MS = 1500;
const MFA_RESOLUTION_TIMEOUT_MS = 10_000;
let pendingMfaResolution:
  | { userId: string; promise: Promise<MfaContinue>; resolvedAt: number }
  | null = null;

function withMfaResolutionTimeout(promise: Promise<MfaContinue>): Promise<MfaContinue> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Security check timed out. Check your connection and try again.")),
      MFA_RESOLUTION_TIMEOUT_MS,
    );
    promise.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error("Security check failed. Try again."));
      },
    );
  });
}

export function isMfaPolicyExemptEmail(email: string | null | undefined): boolean {
  return isAlwaysOnLoginEmail(email);
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

async function resolveMfaForUser(sessionUser: User): Promise<MfaContinue> {
  if (!sessionUser) return { action: "unsigned" };
  if (isMfaPolicyExemptEmail(sessionUser.email)) return { action: "ok" };
  if (!isPhoneVerified(sessionUser)) {
    const fresh = await getFreshAuthUser();
    if (fresh) sessionUser = fresh;
  }
  if (isPhoneVerified(sessionUser)) return { action: "ok" };
  const totpFactors = await listVerifiedTotpFactors();
  const { currentLevel } = await getAssurance();
  if (currentLevel !== "aal2" && totpFactors.length) {
    return { action: "verify", path: `${MFA_VERIFY_PATH}?next=phone` };
  }
  return { action: "setup", path: MFA_SETUP_PATH };
}

export async function resolveMfaContinue(user?: User | null): Promise<MfaContinue> {
  const sessionUser = user === undefined ? await getVerifiedSessionUser() : user;
  if (!sessionUser) return { action: "unsigned" };

  const cached = pendingMfaResolution;
  if (
    cached?.userId === sessionUser.id &&
    (cached.resolvedAt === 0 || Date.now() - cached.resolvedAt < MFA_RESOLUTION_CACHE_MS)
  ) {
    return cached.promise;
  }

  const entry = {
    userId: sessionUser.id,
    promise: withMfaResolutionTimeout(resolveMfaForUser(sessionUser)),
    resolvedAt: 0,
  };
  pendingMfaResolution = entry;
  void entry.promise.then(
    () => {
      entry.resolvedAt = Date.now();
    },
    () => {
      if (pendingMfaResolution === entry) pendingMfaResolution = null;
    },
  );
  return entry.promise;
}

/**
 * A just-created account cannot own a verified phone or authenticator factor, so the
 * destination is already known. Resolving it locally keeps sign-up from blocking on
 * three auth round trips; the guard on the destination still enforces the same policy.
 */
export function mfaPathForNewSignup(user: User | null | undefined): string | null {
  if (!user || hasStoredOwnerGrant()) return null;
  if (isMfaPolicyExemptEmail(user.email)) return null;
  if (isPhoneVerified(user)) return null;
  return MFA_SETUP_PATH;
}

/** After password / OAuth / biometric session is established. */
export async function continueMfaAfterAuth(user?: User | null): Promise<string | null> {
  if (hasStoredOwnerGrant()) return null;
  try {
    const next = await resolveMfaContinue(user);
    if (next.action === "setup" || next.action === "verify") return next.path;
    return null;
  } catch {
    // A stalled check must not turn a successful sign-in into an error or a setup redirect.
    return null;
  }
}

export async function sessionSatisfiesProtectedAccess(): Promise<boolean> {
  if (hasStoredOwnerGrant()) return true;
  const user = await getVerifiedSessionUser();
  if (!user || !isEmailVerified(user)) return false;
  return (await resolveMfaContinue(user)).action === "ok";
}

export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

/** Drop leftover unverified factors, then start a fresh authenticator enrollment. */
export async function startTotpSetup(friendlyName: string): Promise<TotpEnrollment | "verified"> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) {
    throw new Error(error?.message || "Could not start authenticator setup. Try again.");
  }
  const verified = (data.totp ?? []).filter((factor) => factor.status === "verified");
  if (verified.length) return "verified";
  const stale = (data.all ?? []).filter(
    (factor) => factor.factor_type === "totp" && factor.status !== "verified",
  );
  for (const factor of stale) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  return enrollTotpFactor(friendlyName);
}

export async function enrollTotpFactor(friendlyName: string): Promise<TotpEnrollment> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error || !data) {
    throw new Error(error?.message || "Could not start authenticator setup. Try again.");
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
  if (!factors.some((factor) => factor.id === factorId)) throw new Error("Authenticator not found.");
  const sessionUser = await getVerifiedSessionUser();
  if (!isPhoneVerified(sessionUser) && !isPhoneVerified(await getFreshAuthUser())) {
    throw new Error("Verify your phone number before removing an authenticator.");
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
