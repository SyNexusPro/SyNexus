import type { User } from "@supabase/supabase-js";
import { isAlwaysOnLoginEmail } from "../config/googlePlayReview";

/** True when Supabase or Google has confirmed the operator's email address. */
export function isEmailVerified(
  user: Pick<User, "email" | "email_confirmed_at" | "confirmed_at" | "app_metadata" | "identities"> | null,
): boolean {
  if (!user) return false;
  if (isAlwaysOnLoginEmail(user.email)) return true;
  if (user.email_confirmed_at ?? user.confirmed_at) return true;
  const provider = user.app_metadata?.provider;
  if (provider === "google") return true;
  return Boolean(user.identities?.some((identity) => identity.provider === "google"));
}

const PENDING_VERIFY_KEY = "synexus_pending_verification_email";

export function loadPendingVerificationEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PENDING_VERIFY_KEY);
  } catch {
    return null;
  }
}

export function savePendingVerificationEmail(email: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (email) localStorage.setItem(PENDING_VERIFY_KEY, email);
    else localStorage.removeItem(PENDING_VERIFY_KEY);
  } catch {
    /* ignore */
  }
}
