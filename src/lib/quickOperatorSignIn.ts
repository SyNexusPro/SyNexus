import {
  clearBiometricLogin,
  loadBiometricRefreshToken,
  refreshBiometricVaultToken,
} from "./biometricLogin";
import { isEmailVerified } from "./emailVerification";
import { restoreSessionFromRefreshToken } from "./supabaseData";
import { hasSupabaseEnv, supabase } from "./supabaseClient";

export type QuickSignInResult =
  | { ok: true; email: string }
  | { ok: false; error: string; needsEmailSignIn?: boolean };

/** Biometric / saved-device sign-in for Enter Titan on home. */
export async function attemptBiometricQuickSignIn(): Promise<QuickSignInResult> {
  if (!hasSupabaseEnv || !supabase) {
    return { ok: false, error: "Sign-in is not configured.", needsEmailSignIn: true };
  }

  try {
    const vault = await loadBiometricRefreshToken();
    if (!vault?.refreshToken) {
      return {
        ok: false,
        error: "No saved login on this device.",
        needsEmailSignIn: true,
      };
    }

    const { session, user } = await restoreSessionFromRefreshToken(vault.refreshToken);
    const signedIn = user ?? session?.user ?? null;

    if (!signedIn) {
      await clearBiometricLogin();
      return {
        ok: false,
        error: "Saved login expired. Sign in with email again.",
        needsEmailSignIn: true,
      };
    }

    if (!isEmailVerified(signedIn)) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: "Confirm your email before using quick sign-in.",
        needsEmailSignIn: true,
      };
    }

    if (session?.refresh_token) {
      void refreshBiometricVaultToken(signedIn.email ?? vault.email, session.refresh_token);
    }

    return { ok: true, email: signedIn.email ?? vault.email };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quick sign-in failed.";
    const cancelled = message.toLowerCase().includes("cancel");
    return {
      ok: false,
      error: cancelled ? "Sign-in cancelled." : message,
      needsEmailSignIn: !cancelled,
    };
  }
}
