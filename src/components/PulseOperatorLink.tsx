import { useMemo, useState } from "react";
import type { BiometricSupport } from "../lib/biometricLogin";

type AuthTone = "info" | "success" | "error";

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
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignUp: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onOwnerUnlock: () => void;
  onBiometricSignIn: () => void;
  onEnableBiometric: () => void;
  onDisableBiometric: () => void;
  ownerUnlocked?: boolean;
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
  onEmailChange,
  onPasswordChange,
  onSignUp,
  onSignIn,
  onSignOut,
  onOwnerUnlock,
  onBiometricSignIn,
  onEnableBiometric,
  onDisableBiometric,
  ownerUnlocked = false,
}: PulseOperatorLinkProps) {
  const [mode, setMode] = useState<"return" | "link" | "command">("return");
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

  return (
    <section className="operator-link" aria-label="Link your operator ID">
      <div className="operator-link__scanline" aria-hidden="true" />
      <header className="operator-link__head">
        <p className="operator-link__eyebrow">Operator link</p>
        <h2 className="operator-link__title">Save your Synexus command center</h2>
        <p className="operator-link__lede">
          Link once to keep watchlists, alerts, and Synexus Pro on every device. After your first
          sign-in, Synexus can save {biometricLabel} for faster return visits.
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
            value={email}
            disabled={authBusy}
            placeholder={mode === "command" ? "your-secret-id" : "you@email.com"}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <label className="operator-link__field">
          <span>{mode === "command" ? "Command key" : "Access key"}</span>
          <input
            type="password"
            autoComplete={mode === "command" ? "current-password" : mode === "link" ? "new-password" : "current-password"}
            value={password}
            disabled={authBusy}
            placeholder="••••••••"
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        className="operator-link__submit"
        disabled={authBusy}
        onClick={
          mode === "command" ? onOwnerUnlock : mode === "link" ? onSignUp : onSignIn
        }
      >
        {authBusy
          ? "Linking…"
          : mode === "command"
            ? "Unlock full access"
            : mode === "link"
              ? "Establish operator link"
              : "Reconnect to Synexus"}
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
      ) : null}
    </section>
  );
}
