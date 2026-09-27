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
  const ownerPromise = Promise.race([
    unlockOwnerAccess(trimmed, password),
    new Promise<{ ok: false; message: string }>((resolve) => {
      setTimeout(() => resolve({ ok: false, message: "" }), 8_000);
    }),
  ]);

  const supabasePromise = (async () => {
    let user: User | null = null;
    let session: Session | null = null;
    let error: string | null = null;
    if (!hasSupabaseEnv) return { user, session, error };

    try {
      const result = await signInWithEmail(trimmed, password);
      user = result.user ?? result.session?.user ?? null;
      session = result.session ?? null;
      if (user && !isEmailVerified(user) && !isAlwaysOnLoginEmail(trimmed)) {
        if (supabase) await signOut();
        user = null;
        session = null;
        error = "Confirm your email before signing in.";
      } else if (user) {
        await applyGooglePlayReviewAccess(user.id, trimmed);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      const banned = /banned|disabled|user_banned/i.test(message);
      if (!isAlwaysOnLoginEmail(trimmed) || !banned) error = message;
    }
    return { user, session, error };
  })();

  const first = await Promise.race([
    ownerPromise.then((value) => ({ source: "owner" as const, value })),
    supabasePromise.then((value) => ({ source: "supabase" as const, value })),
  ]);
  if (first.source === "owner" && first.value.ok) {
    return {
      ok: true,
      godMode: true,
      playReviewer: isGooglePlayReviewEmail(trimmed),
      user: null,
      session: null,
      message: first.value.message,
    };
  }
  if (first.source === "supabase" && first.value.user) {
    return {
      ok: true,
      godMode: false,
      playReviewer: isGooglePlayReviewEmail(trimmed),
      user: first.value.user,
      session: first.value.session,
      message: isGooglePlayReviewEmail(trimmed)
        ? "Google Play reviewer signed in."
        : "Signed in.",
    };
  }

  const owner = first.source === "owner" ? first.value : await ownerPromise;
  if (owner.ok) {
    return {
      ok: true,
      godMode: true,
      playReviewer: isGooglePlayReviewEmail(trimmed),
      user: null,
      session: null,
      message: owner.message,
    };
  }

  const supabaseResult = first.source === "supabase" ? first.value : await supabasePromise;
  const supabaseUser = supabaseResult.user;
  const supabaseSession = supabaseResult.session;
  const supabaseError = supabaseResult.error;

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
