import { isAlwaysOnLoginEmail, isGooglePlayReviewEmail } from "../config/googlePlayReview";
import { applyGooglePlayReviewAccess } from "./googlePlayReviewAccess";
import { unlockOwnerAccess } from "./ownerAccess";
import { isEmailVerified } from "./emailVerification";
import { signInWithEmail, signOut } from "./supabaseData";
import { hasSupabaseEnv, supabase } from "./supabaseClient";
import type { Session, User } from "@supabase/supabase-js";

export type AlwaysOnSignInResult = {
  ok: boolean;
  godMode: boolean;
  playReviewer: boolean;
  user: User | null;
  session: Session | null;
  message: string;
};

/**
 * Owner god-mode and Google Play reviewer must always work.
 * Tries server owner unlock and Supabase password in parallel.
 */
export async function signInAlwaysOnAccount(
  email: string,
  password: string,
): Promise<AlwaysOnSignInResult> {
  const trimmed = email.trim();
  const ownerAttempt = unlockOwnerAccess(trimmed, password);
  let supabaseUser: User | null = null;
  let supabaseSession: Session | null = null;
  let supabaseError: string | null = null;

  if (hasSupabaseEnv) {
    try {
      const result = await signInWithEmail(trimmed, password);
      const user = result.user ?? result.session?.user ?? null;
      if (user && !isEmailVerified(user) && !isAlwaysOnLoginEmail(trimmed)) {
        if (supabase) await signOut();
        supabaseError = "Confirm your email before signing in.";
      } else {
        supabaseUser = user;
        supabaseSession = result.session ?? null;
        if (user) await applyGooglePlayReviewAccess(user.id, trimmed);
      }
    } catch (err) {
      supabaseError = err instanceof Error ? err.message : "Sign-in failed.";
    }
  }

  const owner = await ownerAttempt;
  if (owner.ok) {
    return {
      ok: true,
      godMode: true,
      playReviewer: isGooglePlayReviewEmail(trimmed),
      user: supabaseUser,
      session: supabaseSession,
      message: owner.message,
    };
  }

  if (supabaseUser) {
    return {
      ok: true,
      godMode: false,
      playReviewer: isGooglePlayReviewEmail(trimmed),
      user: supabaseUser,
      session: supabaseSession,
      message: isGooglePlayReviewEmail(trimmed)
        ? "Google Play reviewer signed in."
        : "Signed in.",
    };
  }

  return {
    ok: false,
    godMode: false,
    playReviewer: false,
    user: null,
    session: null,
    message: supabaseError || owner.message || "Sign-in failed.",
  };
}
