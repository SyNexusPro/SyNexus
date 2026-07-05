import type { User } from "@supabase/supabase-js";

/** True when Supabase has confirmed the operator's email address. */
export function isEmailVerified(user: Pick<User, "email_confirmed_at" | "confirmed_at"> | null): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

const PENDING_VERIFY_KEY = "hivemind_pending_verification_email";

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
