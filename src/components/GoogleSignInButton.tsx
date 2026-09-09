import { useState } from "react";
import { googleSignInAvailable } from "../lib/googleSignIn";
import { signInWithOAuth } from "../lib/supabaseData";

type Props = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M9 7.2v3.5h4.9c-.2 1.2-1.5 3.5-4.9 3.5A5.2 5.2 0 1 1 9 3.8c1.5 0 2.5.6 3.1 1.2l2.1-2C12.8 1.6 11.1.8 9 .8 4.6.8 1.1 4.4 1.1 9S4.6 17.2 9 17.2c5.2 0 8.6-3.6 8.6-8.7 0-.6 0-1-.1-1.3H9z" />
    </svg>
  );
}

/**
 * Starts Google OAuth via Supabase. Enable the Google provider in
 * Supabase → Authentication → Providers, and add this site URL to Redirect URLs.
 */
export function GoogleSignInButton({ disabled = false, onError }: Props) {
  const [busy, setBusy] = useState(false);
  if (!googleSignInAvailable()) return null;

  return (
    <button
      type="button"
      className="auth-google"
      disabled={disabled || busy}
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            await signInWithOAuth("google");
          } catch (err) {
            const message = err instanceof Error ? err.message : "Google sign-in failed.";
            onError?.(message);
            setBusy(false);
          }
        })();
      }}
    >
      <GoogleMark />
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

export function AuthMethodDivider() {
  return (
    <p className="auth-method-divider" role="separator">
      <span>or continue with</span>
    </p>
  );
}

/** Divider + Google button after email submit. Hidden when OAuth is unavailable. */
export function GoogleAuthOption({ disabled = false, onError }: Props) {
  if (!googleSignInAvailable()) return null;
  return (
    <>
      <AuthMethodDivider />
      <GoogleSignInButton disabled={disabled} onError={onError} />
    </>
  );
}
