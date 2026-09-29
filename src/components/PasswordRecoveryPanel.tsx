import { useRef, useState } from "react";
import { PasswordRevealToggle } from "./PasswordRevealToggle";
import { validateSignupPassword } from "../lib/authCredentials";
import { describeAuthError } from "../lib/authErrors";
import { beginInteractiveAuthFlow, endInteractiveAuthFlow } from "../lib/authFlowGuard";
import {
  normalizeRecoveryCode,
  normalizeRecoveryEmail,
  passwordRecoveryInboxMessage,
  PASSWORD_RECOVERY_SUCCESS,
  RECOVERY_CODE_LENGTH,
} from "../lib/passwordRecovery";
import { hasSupabaseEnv } from "../lib/supabaseClient";
import {
  requestPasswordReset,
  signOut,
  updatePassword,
  verifyPasswordRecoveryCode,
} from "../lib/supabaseData";
import { withTimeout } from "../lib/withTimeout";

type Step = "request" | "code" | "done";
type Tone = "info" | "success" | "error";

type Props = {
  initialEmail?: string;
  /** Called after the password change, to hand control back to the normal sign-in screen. */
  onFinished?: (email: string) => void;
  onCancel?: () => void;
};

export function PasswordRecoveryPanel({ initialEmail = "", onFinished, onCancel }: Props) {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(initialEmail);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);
  const submitting = useRef(false);

  const trimmedEmail = normalizeRecoveryEmail(email);

  async function handleSendCode() {
    if (busy || submitting.current) return;
    if (!trimmedEmail) {
      setMessage({ tone: "error", text: "Enter your email address first." });
      return;
    }
    if (!hasSupabaseEnv) {
      setMessage({ tone: "error", text: "Password recovery requires Supabase sign-in." });
      return;
    }

    submitting.current = true;
    beginInteractiveAuthFlow();
    setBusy(true);
    setMessage({ tone: "info", text: "Sending your recovery code…" });
    try {
      await withTimeout(requestPasswordReset(trimmedEmail));
      setStep("code");
      setMessage({ tone: "success", text: passwordRecoveryInboxMessage(trimmedEmail) });
    } catch (err) {
      console.error("PASSWORD RECOVERY ERROR:", err);
      setMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      submitting.current = false;
      endInteractiveAuthFlow();
      setBusy(false);
    }
  }

  async function handleChangePassword() {
    if (busy || submitting.current) return;

    const code = normalizeRecoveryCode(recoveryCode);
    if (code.length !== RECOVERY_CODE_LENGTH) {
      setMessage({ tone: "error", text: `Enter the ${RECOVERY_CODE_LENGTH}-digit code from your email.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: "error", text: "The two passwords do not match." });
      return;
    }
    const check = validateSignupPassword(newPassword);
    if (!check.ok) {
      setMessage({ tone: "error", text: check.message ?? "Choose a stronger password." });
      return;
    }

    submitting.current = true;
    beginInteractiveAuthFlow();
    setBusy(true);
    setMessage({ tone: "info", text: "Checking your recovery code…" });
    try {
      await withTimeout(verifyPasswordRecoveryCode(trimmedEmail, code));
      setMessage({ tone: "info", text: "Code accepted. Saving your new password…" });
      await withTimeout(updatePassword(newPassword));

      setRecoveryCode("");
      setNewPassword("");
      setConfirmPassword("");
      // The recovery code opened a session; close it so the operator signs in fresh.
      await withTimeout(signOut(), 8_000).catch(() => {
        /* password already changed — a lingering session is cleared on next load */
      });
      setStep("done");
      setMessage({ tone: "success", text: PASSWORD_RECOVERY_SUCCESS });
    } catch (err) {
      console.error("PASSWORD RECOVERY ERROR:", err);
      setMessage({ tone: "error", text: describeRecoveryError(err) });
    } finally {
      submitting.current = false;
      endInteractiveAuthFlow();
      setBusy(false);
    }
  }

  return (
    <section className="operator-link password-recovery" aria-label="Reset your password">
      <header className="operator-link__head">
        <p className="operator-link__eyebrow">Account recovery</p>
        <h2 className="operator-link__title">
          {step === "done" ? "Password changed" : "Reset your password"}
        </h2>
        <p className="operator-link__lede">
          {step === "request"
            ? "Enter your email and we'll send a 6-digit recovery code. You stay right here in SyNexus — no links to open."
            : step === "code"
              ? "Type the code from your email, then choose a new password."
              : "Sign in with your new password to get back into SyNexus."}
        </p>
      </header>

      {message ? (
        <p
          className={`operator-link__message operator-link__message--${message.tone}`}
          role="status"
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}

      {step === "request" ? (
        <form
          className="operator-link__fields"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSendCode();
          }}
        >
          <label className="operator-link__field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              disabled={busy}
              placeholder="you@email.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" className="operator-link__submit" disabled={busy || !trimmedEmail}>
            {busy ? "Sending…" : "Email my recovery code"}
          </button>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="operator-link__fields"
          onSubmit={(event) => {
            event.preventDefault();
            void handleChangePassword();
          }}
        >
          <label className="operator-link__field">
            <span>Recovery code</span>
            <input
              className="password-recovery__code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={RECOVERY_CODE_LENGTH}
              value={recoveryCode}
              disabled={busy}
              placeholder="123456"
              aria-describedby="password-recovery-code-hint"
              onChange={(event) => setRecoveryCode(normalizeRecoveryCode(event.target.value))}
            />
            <span className="operator-link__password-hint" id="password-recovery-code-hint">
              Sent to {trimmedEmail || "your inbox"}
            </span>
          </label>

          <label className="operator-link__field">
            <span>New password</span>
            <div className="operator-link__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                disabled={busy}
                placeholder="••••••••••"
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <PasswordRevealToggle
                revealed={showPassword}
                disabled={busy}
                onToggle={() => setShowPassword((v) => !v)}
              />
            </div>
            <span className="operator-link__password-hint">
              At least 10 characters, with a letter and a number.
            </span>
          </label>

          <label className="operator-link__field">
            <span>Confirm new password</span>
            <div className="operator-link__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                disabled={busy}
                placeholder="••••••••••"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </label>

          <button type="submit" className="operator-link__submit" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>

          <button
            type="button"
            className="operator-link__text-action"
            disabled={busy}
            onClick={() => void handleSendCode()}
          >
            Send a new code
          </button>
        </form>
      ) : null}

      {step === "done" ? (
        <button
          type="button"
          className="operator-link__submit"
          onClick={() => onFinished?.(trimmedEmail)}
        >
          Back to sign in
        </button>
      ) : null}

      {step !== "done" && onCancel ? (
        <button type="button" className="operator-link__text-action" disabled={busy} onClick={onCancel}>
          Cancel — back to sign in
        </button>
      ) : null}
    </section>
  );
}

function describeRecoveryError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("expired") || lower.includes("invalid") || lower.includes("otp")) {
    return "That code is wrong or has expired. Send a new code and try again.";
  }
  return describeAuthError(err);
}
