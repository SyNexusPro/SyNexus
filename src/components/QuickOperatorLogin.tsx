import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { passwordStrengthLabel, validateSignupPassword } from "../lib/authCredentials";
import { loadRememberedEmail, saveRememberedEmail } from "../lib/authRemember";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import { signInAlwaysOnAccount } from "../lib/alwaysOnSignIn";
import { clearOwnerAccess } from "../lib/ownerAccess";
import {
  requestPasswordReset,
  signOut,
  signUpWithEmail,
  upsertSignupProfile,
} from "../lib/supabaseData";
import { isEmailVerified, savePendingVerificationEmail } from "../lib/emailVerification";
import { SYNEXUS_BRAND_NAME } from "../config/brand";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { applyGooglePlayReviewAccess } from "../lib/googlePlayReviewAccess";
import {
  SIGNUP_WELCOME_ACTIVE,
  markAwaitingSignupWelcome,
  signupConfirmInboxMessage,
} from "../lib/signupWelcome";
import { describeAuthError } from "../lib/authErrors";
import { passwordResetInboxMessage } from "../lib/passwordRecovery";
import { attachPendingInvite, syncInviteRewardForUser } from "../lib/inviteEarn";
import { syncProTrialForUser } from "../lib/proDemo";
import { queueHeraSignupDemo } from "../lib/heraSignupDemo";
import { LanguagePicker } from "./LanguagePicker";
import { PasswordRevealToggle } from "./PasswordRevealToggle";
import { GoogleAuthOption } from "./GoogleSignInButton";
import { continueMfaAfterAuth } from "../security/mfa";
import { readGoogleAuthError } from "../lib/googleAuthReturn";
import { recordSecurityEvent } from "../security/securityEvents";

const DEMO_SESSION_KEY = "synexus_demo_session";

export type QuickOperatorAuthResult = {
  mode: "signin" | "signup";
  userId?: string;
  email?: string;
  playReviewer?: boolean;
  godMode?: boolean;
};

type Props = {
  onSuccess?: (result?: QuickOperatorAuthResult) => void;
  compact?: boolean;
  initialMode?: "signin" | "signup";
  showTabs?: boolean;
};

function finishLinkedSession(userId: string) {
  syncProTrialForUser(userId);
  void attachPendingInvite();
  void syncInviteRewardForUser();
}

export function QuickOperatorLogin({
  onSuccess,
  compact = false,
  initialMode = "signin",
  showTabs = true,
}: Props) {
  const { t } = useTranslation();
  const { linked, secondFactorPath } = useOperatorAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState(() => loadRememberedEmail() ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(
    null,
  );

  const passwordHint = useMemo(() => {
    if (mode !== "signup" || !password) return null;
    const check = validateSignupPassword(password);
    if (!check.ok) return check.message ?? null;
    return passwordStrengthLabel(check.score);
  }, [mode, password]);

  useEffect(() => {
    setMode(initialMode);
    setMessage(null);
  }, [initialMode]);

  useEffect(() => {
    const stored = readGoogleAuthError();
    if (stored) setMessage({ tone: "error", text: describeAuthError(new Error(stored)) });
    const onOauthError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setMessage({ tone: "error", text: describeAuthError(new Error(detail)) });
    };
    window.addEventListener("synexus-oauth-error", onOauthError);
    return () => window.removeEventListener("synexus-oauth-error", onOauthError);
  }, []);

  async function handleForgotPassword() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage({ tone: "error", text: "Enter your email first, then request a reset link." });
      return;
    }
    if (!hasSupabaseEnv) {
      setMessage({ tone: "error", text: "Password reset requires Supabase sign-in." });
      return;
    }
    setBusy(true);
    setMessage({ tone: "info", text: "Sending password reset link…" });
    try {
      await requestPasswordReset(trimmedEmail);
      saveRememberedEmail(trimmedEmail);
      setPassword("");
      setMessage({
        tone: "success",
        text: passwordResetInboxMessage(trimmedEmail),
      });
    } catch (err) {
      setMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setMessage({ tone: "error", text: "Enter email and password." });
      return;
    }
    if (mode === "signup" && !username.trim()) {
      setMessage({ tone: "error", text: "Pick a username for your profile." });
      return;
    }

    setBusy(true);
    setMessage({
      tone: "info",
      text: mode === "signup" ? "Creating account…" : "Signing in…",
    });

    try {
      if (!hasSupabaseEnv) {
        localStorage.setItem(DEMO_SESSION_KEY, `demo-${Date.now()}`);
        setMessage({ tone: "success", text: "Demo session started." });
        onSuccess?.();
        return;
      }

      if (mode === "signup") {
        const check = validateSignupPassword(password);
        if (!check.ok) {
          setMessage({ tone: "error", text: check.message ?? "Choose a stronger password." });
          return;
        }
        const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
        const result = await signUpWithEmail(trimmedEmail, password, normalizedUsername);
        saveRememberedEmail(trimmedEmail);
        const user = result.session?.user ?? result.user;
        if (user) {
          try {
            await upsertSignupProfile(user.id, trimmedEmail, normalizedUsername);
          } catch {
            /* profile may exist */
          }
        }
        setPassword("");
        markAwaitingSignupWelcome();

        const verified = Boolean(user && result.session && isEmailVerified(user));
        if (!verified) {
          if (result.session && hasSupabaseEnv && supabase) {
            window.setTimeout(() => {
              void signOut();
            }, 0);
          }
          savePendingVerificationEmail(trimmedEmail);
          setMessage({
            tone: "success",
            text: signupConfirmInboxMessage(trimmedEmail),
          });
          return;
        }

        finishLinkedSession(user!.id);
        queueHeraSignupDemo();
        setMessage({ tone: "success", text: SIGNUP_WELCOME_ACTIVE });
        const mfaPath = await continueMfaAfterAuth(user);
        onSuccess?.({ mode: "signup", userId: user!.id, email: trimmedEmail });
        if (mfaPath) navigate(mfaPath, { replace: true });
        return;
      }

      const alwaysOn = await signInAlwaysOnAccount(trimmedEmail, password);
      if (!alwaysOn.ok) {
        throw new Error(alwaysOn.message);
      }
      const signedInUser = alwaysOn.user;
      saveRememberedEmail(trimmedEmail);
      if (signedInUser?.id) {
        await applyGooglePlayReviewAccess(signedInUser.id, trimmedEmail);
        finishLinkedSession(signedInUser.id);
      }
      setPassword("");
      setMessage({
        tone: "success",
        text: alwaysOn.godMode
          ? alwaysOn.message
          : alwaysOn.playReviewer
            ? "Google Play reviewer signed in."
            : "Signed in.",
      });
      void recordSecurityEvent({ eventType: "login_success", success: true });
      const mfaPath =
        alwaysOn.godMode || alwaysOn.playReviewer ? null : await continueMfaAfterAuth(signedInUser);
      onSuccess?.({
        mode: "signin",
        userId: signedInUser?.id,
        email: trimmedEmail,
        playReviewer: alwaysOn.playReviewer,
        godMode: alwaysOn.godMode,
      });
      if (mfaPath) navigate(mfaPath, { replace: true });
    } catch (err) {
      void recordSecurityEvent({ eventType: "login_failure", success: false });
      setMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  if (secondFactorPath) {
    return (
      <div className="quick-login quick-login--linked">
        <p className="quick-login__linked">Finish the second sign-in check to open your account.</p>
        <button
          type="button"
          className="quick-login__submit"
          onClick={() => {
            onSuccess?.();
            navigate(secondFactorPath);
          }}
        >
          Continue verification
        </button>
      </div>
    );
  }

  if (linked) {
    return (
      <div className="quick-login quick-login--linked">
        <p className="quick-login__linked">You&apos;re signed in.</p>
        <button type="button" className="quick-login__submit" onClick={() => onSuccess?.()}>
          Close
        </button>
        <button
          type="button"
          className="quick-login__signout"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                localStorage.removeItem(DEMO_SESSION_KEY);
                clearOwnerAccess();
                if (hasSupabaseEnv && supabase) {
                  await signOut();
                }
                onSuccess?.();
              } catch (err) {
                setMessage({ tone: "error", text: describeAuthError(err) });
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  return (
    <section className={`quick-login${compact ? " quick-login--compact" : ""}`} aria-label="Account access">
      {showTabs ? (
        <div className="quick-login__tabs" role="tablist" aria-label="Account mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={`quick-login__tab${mode === "signin" ? " quick-login__tab--active" : ""}`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`quick-login__tab${mode === "signup" ? " quick-login__tab--active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>
      ) : (
        <p className="quick-login__mode-label">
          {mode === "signup"
            ? `Create your ${SYNEXUS_BRAND_NAME} account`
            : `Sign in to ${SYNEXUS_BRAND_NAME}`}
        </p>
      )}

      {message ? (
        <p className={`quick-login__message quick-login__message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}

      <form
        className="quick-login__fields"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className="quick-login__field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            disabled={busy}
            placeholder="you@email.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {mode === "signup" ? (
          <label className="quick-login__field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              disabled={busy}
              placeholder="your_handle"
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
        ) : null}
        <label className="quick-login__field">
          <span>Password</span>
          <div className="password-reveal">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              disabled={busy}
              placeholder="••••••••••"
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordRevealToggle
              revealed={showPassword}
              disabled={busy}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </div>
          {passwordHint ? <span className="quick-login__hint">{passwordHint}</span> : null}
          {mode === "signin" && hasSupabaseEnv ? (
            <button
              type="button"
              className="quick-login__forgot"
              disabled={busy || !email.trim()}
              onClick={() => void handleForgotPassword()}
            >
              Forgot password?
            </button>
          ) : null}
        </label>
        {mode === "signup" ? (
          <label className="quick-login__field">
            <span>{t("footer.language")}</span>
            <LanguagePicker embedded />
          </label>
        ) : null}
      <button type="submit" className="quick-login__submit" disabled={busy}>
        {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      </form>
      <GoogleAuthOption disabled={busy} onError={(text) => setMessage({ tone: "error", text })} />
      {mode === "signup" ? (
        <p className="quick-login__hint">
          Confirm the email, then enter the 6-digit code from your authenticator app. That second check is required
          each time you sign in.
        </p>
      ) : null}
    </section>
  );
}
