import { useMemo, useState } from "react";
import type { BiometricSupport } from "../lib/biometricLogin";
import { SYNEXUS_PRO_TRIAL_DAYS } from "../config/proTrial";

type AuthTone = "info" | "success" | "error";
type SignInMethod = "magic" | "password";

type PulseOperatorLinkProps = {
  userId: string | null;
  operatorName: string;
  userEmail: string | null;
  plan: "FREE" | "PRO";
  email: string;
  password: string;
  authBusy: boolean;
  authBusyLabel: string;
  authMessage: { tone: AuthTone; text: string };
  hasSupabaseEnv: boolean;
  biometricSupport: BiometricSupport | null;
  biometricEnrolled: boolean;
  biometricEmailHint: string | null;
  recoveryMode?: boolean;
  emailVerificationPending?: boolean;
  pendingVerificationEmail?: string | null;
  signupPasswordHint?: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignUp: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onOwnerUnlock: () => void;
  onBiometricSignIn: () => void;
  onEnableBiometric: () => void;
  onDisableBiometric: () => void;
  onMagicLink: () => void;
  onForgotPassword: () => void;
  onUpdatePassword: (password: string) => void;
  onResendVerification: () => void;
  onContinueToSignIn: () => void;
  ownerUnlocked?: boolean;
  variant?: "default" | "oracle";
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}••••@${domain}`;
}

function operatorInitials(name: string, email: string | null): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length >= 2) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  if (email?.[0]) return email[0].toUpperCase();
  return "OP";
}

export function PulseOperatorLink({
  userId,
  operatorName,
  userEmail,
  plan,
  email,
  password,
  authBusy,
  authBusyLabel,
  authMessage,
  hasSupabaseEnv,
  biometricSupport,
  biometricEnrolled,
  biometricEmailHint,
  recoveryMode = false,
  emailVerificationPending = false,
  pendingVerificationEmail = null,
  signupPasswordHint,
  onEmailChange,
  onPasswordChange,
  onSignUp,
  onSignIn,
  onSignOut,
  onOwnerUnlock,
  onBiometricSignIn,
  onEnableBiometric,
  onDisableBiometric,
  onMagicLink,
  onForgotPassword,
  onUpdatePassword,
  onResendVerification,
  onContinueToSignIn,
  ownerUnlocked = false,
  variant = "default",
}: PulseOperatorLinkProps) {
  const [mode, setMode] = useState<"return" | "link" | "command">(variant === "oracle" ? "link" : "return");
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("magic");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const linked = Boolean(userId);
  const isDemo = userId?.startsWith("demo-") ?? false;
  const biometricLabel = biometricSupport?.label ?? "Biometrics";
  const canUseBiometric = Boolean(biometricSupport?.available && hasSupabaseEnv && !isDemo);

  const displayEmail = useMemo(() => {
    if (userEmail) return maskEmail(userEmail);
    if (isDemo) return "Demo operator session";
    return "Operator channel active";
  }, [isDemo, userEmail]);

  const initials = operatorInitials(operatorName, userEmail);

  if (recoveryMode && hasSupabaseEnv) {
    const passwordsMatch = password.length > 0 && password === confirmPassword;
    return (
      <section className="operator-link" aria-label="Set a new password">
        <header className="operator-link__head">
          <p className="operator-link__eyebrow">Secure reset</p>
          <h2 className="operator-link__title">Choose a new access key</h2>
          <p className="operator-link__lede">
            Use at least 10 characters with letters and numbers. We never store your password in plain text.
          </p>
        </header>

        <p className={`operator-link__message operator-link__message--${authMessage.tone}`} role="status">
          {authMessage.text}
        </p>

        <div className="operator-link__fields">
          <label className="operator-link__field">
            <span>New access key</span>
            <div className="operator-link__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                disabled={authBusy}
                placeholder="••••••••••"
                onChange={(event) => onPasswordChange(event.target.value)}
              />
              <button
                type="button"
                className="operator-link__password-toggle"
                disabled={authBusy}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {signupPasswordHint ? (
              <span className="operator-link__password-hint">{signupPasswordHint}</span>
            ) : null}
          </label>
          <label className="operator-link__field">
            <span>Confirm access key</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              disabled={authBusy}
              placeholder="••••••••••"
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          className="operator-link__submit"
          disabled={authBusy || !passwordsMatch}
          onClick={() => onUpdatePassword(password)}
        >
          {authBusy ? "Saving…" : "Save new access key"}
        </button>
      </section>
    );
  }

  if (emailVerificationPending && hasSupabaseEnv) {
    const maskedPending = pendingVerificationEmail ? maskEmail(pendingVerificationEmail) : "your inbox";
    return (
      <section className="operator-link operator-link--pending" aria-label="Verify your email">
        <header className="operator-link__head">
          <p className="operator-link__eyebrow">Security check</p>
          <h2 className="operator-link__title">Verify your email</h2>
          <p className="operator-link__lede">
            We sent a confirmation link to <strong>{maskedPending}</strong>. Operator Link stays locked until
            you verify — this keeps your watchlists and Pro status tied to a real inbox.
          </p>
        </header>

        <p className={`operator-link__message operator-link__message--${authMessage.tone}`} role="status">
          {authMessage.text}
        </p>

        <button
          type="button"
          className="operator-link__submit"
          disabled={authBusy}
          onClick={onResendVerification}
        >
          {authBusy ? authBusyLabel : "Resend verification email"}
        </button>

        <button
          type="button"
          className="operator-link__biometric-disable"
          disabled={authBusy}
          onClick={onContinueToSignIn}
        >
          I verified — sign in
        </button>

        <p className="operator-link__footnote">
          Link expires after a while. Check spam, then resend if needed.
        </p>
      </section>
    );
  }

  if (linked) {
    return (
      <section className="operator-link operator-link--active" aria-label="Operator link status">
        <div className="operator-link__scanline" aria-hidden="true" />
        <header className="operator-link__head">
          <p className="operator-link__eyebrow">Operator link · active</p>
          <div className="operator-link__profile">
            <div className="operator-link__orb" aria-hidden="true">
              <span>{initials}</span>
              <i className="operator-link__orb-ring" />
            </div>
            <div className="operator-link__identity">
              <h2 className="operator-link__name">{operatorName}</h2>
              <p className="operator-link__email">{displayEmail}</p>
            </div>
            <span className={`operator-link__plan operator-link__plan--${plan.toLowerCase()}`}>
              {ownerUnlocked ? "Owner · full access" : plan === "PRO" ? "Synexus Pro" : "Free tier"}
            </span>
          </div>
        </header>

        <div className="operator-link__sync" role="status">
          <span className="operator-link__sync-dot" aria-hidden="true" />
          Synchronized with The Synexus
        </div>

        {canUseBiometric ? (
          <div className="operator-link__biometric operator-link__biometric--active">
            {biometricEnrolled ? (
              <>
                <p className="operator-link__biometric-status">
                  <span className="operator-link__biometric-icon" aria-hidden>
                    ◉
                  </span>
                  {biometricLabel} sign-in enabled
                </p>
                <button
                  type="button"
                  className="operator-link__biometric-disable"
                  disabled={authBusy}
                  onClick={onDisableBiometric}
                >
                  Turn off {biometricLabel}
                </button>
              </>
            ) : (
              <>
                <p className="operator-link__biometric-lede">
                  Skip typing your password — use {biometricLabel} next time.
                </p>
                <button
                  type="button"
                  className="operator-link__biometric-enable"
                  disabled={authBusy}
                  onClick={onEnableBiometric}
                >
                  Enable {biometricLabel} sign-in
                </button>
              </>
            )}
          </div>
        ) : null}

        <p className={`operator-link__message operator-link__message--${authMessage.tone}`}>
          {authMessage.text}
        </p>

        {authBusy ? (
          <p className="operator-link__loading" role="status">
            {authBusyLabel}
          </p>
        ) : null}

        <button type="button" className="operator-link__disconnect" disabled={authBusy} onClick={onSignOut}>
          Disconnect link
        </button>
      </section>
    );
  }

  const showPasswordField = mode !== "command" && (mode === "link" || signInMethod === "password");
  const submitLabel =
    mode === "command"
      ? "Unlock full access"
      : mode === "link"
        ? "Establish operator link"
        : signInMethod === "magic"
          ? "Email me a sign-in link"
          : "Reconnect to Synexus";

  return (
    <section
      className={`operator-link${variant === "oracle" ? " operator-link--oracle-gate" : ""}`}
      aria-label={variant === "oracle" ? "Oracle Supreme access gate" : "Link your operator ID"}
    >
      <div className="operator-link__scanline" aria-hidden="true" />
      <header className="operator-link__head">
        <p className="operator-link__eyebrow">
          {variant === "oracle" ? "Oracle Supreme · access gate" : "Operator link"}
        </p>
        <h2 className="operator-link__title">
          {variant === "oracle" ? "Create your operator link" : "Save your Synexus command center"}
        </h2>
        <p className="operator-link__lede">
          {variant === "oracle" ? (
            <>
              Sign up free to enter Oracle Supreme and unlock a{" "}
              <strong>{SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial</strong> — no credit card required. Already
              linked? Switch to Return.
            </>
          ) : (
            <>
              Sign in with a secure email link — no password to remember — or use an access key. After your
              first sign-in, Synexus can save {biometricLabel} on mobile.
            </>
          )}
        </p>
      </header>

      {canUseBiometric && biometricEnrolled ? (
        <div className="operator-link__biometric">
          <button
            type="button"
            className="operator-link__biometric-signin"
            disabled={authBusy}
            onClick={onBiometricSignIn}
          >
            <span className="operator-link__biometric-icon" aria-hidden>
              ◉
            </span>
            Sign in with {biometricLabel}
          </button>
          {biometricEmailHint ? (
            <p className="operator-link__biometric-hint">Saved for {maskEmail(biometricEmailHint)}</p>
          ) : null}
        </div>
      ) : null}

      {canUseBiometric && biometricEnrolled ? (
        <p className="operator-link__biometric-divider">
          <span>or use email</span>
        </p>
      ) : null}

      <div className="operator-link__tabs" role="tablist" aria-label="Link mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "return"}
          className={`operator-link__tab${mode === "return" ? " operator-link__tab--active" : ""}`}
          onClick={() => setMode("return")}
        >
          Return
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "link"}
          className={`operator-link__tab${mode === "link" ? " operator-link__tab--active" : ""}`}
          onClick={() => setMode("link")}
        >
          New link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "command"}
          className={`operator-link__tab${mode === "command" ? " operator-link__tab--active" : ""}`}
          onClick={() => setMode("command")}
        >
          Command code
        </button>
      </div>

      {mode === "return" && hasSupabaseEnv ? (
        <div className="operator-link__method" role="group" aria-label="Sign-in method">
          <button
            type="button"
            className={`operator-link__method-btn${signInMethod === "magic" ? " operator-link__method-btn--active" : ""}`}
            disabled={authBusy}
            onClick={() => setSignInMethod("magic")}
          >
            Email link
          </button>
          <button
            type="button"
            className={`operator-link__method-btn${signInMethod === "password" ? " operator-link__method-btn--active" : ""}`}
            disabled={authBusy}
            onClick={() => setSignInMethod("password")}
          >
            Password
          </button>
        </div>
      ) : null}

      <p className={`operator-link__message operator-link__message--${authMessage.tone}`} role="status">
        {authMessage.text}
      </p>

      {authBusy ? (
        <p className="operator-link__loading" role="status">
          {authBusyLabel}
        </p>
      ) : null}

      <div className="operator-link__fields">
        <label className="operator-link__field">
          <span>{mode === "command" ? "Command ID" : "Operator email"}</span>
          <input
            type={mode === "command" ? "text" : "email"}
            autoComplete={mode === "command" ? "username" : "email"}
            inputMode={mode === "command" ? "text" : "email"}
            value={email}
            disabled={authBusy}
            placeholder={mode === "command" ? "your-secret-id" : "you@email.com"}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        {showPasswordField ? (
          <label className="operator-link__field">
            <span>{mode === "link" ? "Choose access key" : "Access key"}</span>
            <div className="operator-link__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "link" ? "new-password" : "current-password"}
                value={password}
                disabled={authBusy}
                placeholder="••••••••••"
                onChange={(event) => onPasswordChange(event.target.value)}
              />
              <button
                type="button"
                className="operator-link__password-toggle"
                disabled={authBusy}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "link" && signupPasswordHint ? (
              <span className="operator-link__password-hint">{signupPasswordHint}</span>
            ) : null}
          </label>
        ) : mode === "return" && signInMethod === "magic" ? (
          <p className="operator-link__magic-note">
            We&apos;ll email a one-time link that expires quickly. No password is sent or stored on this device.
          </p>
        ) : null}
      </div>

      {mode === "return" && signInMethod === "password" && hasSupabaseEnv ? (
        <button
          type="button"
          className="operator-link__text-action"
          disabled={authBusy || !email.trim()}
          onClick={onForgotPassword}
        >
          Forgot access key?
        </button>
      ) : null}

      <button
        type="button"
        className="operator-link__submit"
        disabled={authBusy}
        onClick={
          mode === "command"
            ? onOwnerUnlock
            : mode === "link"
              ? onSignUp
              : signInMethod === "magic"
                ? onMagicLink
                : onSignIn
        }
      >
        {authBusy ? "Linking…" : submitLabel}
      </button>

      {mode === "command" ? (
        <p className="operator-link__footnote">
          Your private command code unlocks everything — no subscription required on this device.
        </p>
      ) : !hasSupabaseEnv ? (
        <p className="operator-link__footnote">Demo mode — server keys unlock permanent operator links.</p>
      ) : !canUseBiometric && biometricSupport?.native === false ? (
        <p className="operator-link__footnote">
          Face ID and fingerprint sign-in are available in the Synexus Android and iOS app.
        </p>
      ) : mode === "return" && signInMethod === "magic" ? (
        <p className="operator-link__footnote">
          Prefer a password? Switch to Password above, or create a new link on the New link tab.
        </p>
      ) : null}
    </section>
  );
}
