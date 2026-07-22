import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasStoredOwnerGrant, unlockOwnerAccess } from "../lib/ownerAccess";

type Props = {
  /** After unlock, navigate here (default /pulse). */
  redirectTo?: string;
  compact?: boolean;
};

export function GodModeLogin({ redirectTo = "/pulse", compact = false }: Props) {
  const navigate = useNavigate();
  const [commandId, setCommandId] = useState("");
  const [commandKey, setCommandKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(() => hasStoredOwnerGrant());
  const [message, setMessage] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    setActive(hasStoredOwnerGrant());
  }, []);

  async function handleSubmit() {
    if (busy) return;
    if (!commandId.trim() || !commandKey) {
      setMessage({ tone: "error", text: "Enter your god mode ID and key." });
      return;
    }

    setBusy(true);
    setMessage({ tone: "info", text: "Verifying god mode credentials…" });

    const result = await unlockOwnerAccess(commandId, commandKey);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      setBusy(false);
      return;
    }

    setActive(true);
    setCommandKey("");
    setMessage({ tone: "success", text: result.message });
    setBusy(false);
    window.setTimeout(() => navigate(redirectTo), 600);
  }

  if (active) {
    return (
      <section className={`god-mode-login${compact ? " god-mode-login--compact" : ""}`} aria-label="God mode">
        <p className="god-mode-login__badge">God mode active</p>
        <p className="god-mode-login__lede">
          Full SyNexusPro access is unlocked on this device — analytics, Sentinels, and Titan without billing.
        </p>
        <div className="god-mode-login__actions">
          <Link to="/pulse" className="god-mode-login__cta">
            Open Pulse
          </Link>
          <Link to="/analytics" className="god-mode-login__cta god-mode-login__cta--secondary">
            Analytics
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`god-mode-login${compact ? " god-mode-login--compact" : ""}`} aria-label="God mode sign-in">
      <p className="god-mode-login__eyebrow">SyNexus · operator override</p>
      <h1 className="god-mode-login__title">God mode</h1>
      <p className="god-mode-login__lede">
        Server-verified owner login. Unlocks full Pro, analytics, and command center access without a subscription.
      </p>

      {message ? (
        <p className={`god-mode-login__message god-mode-login__message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="god-mode-login__fields">
        <label className="god-mode-login__field">
          <span>God mode ID</span>
          <input
            type="text"
            autoComplete="username"
            value={commandId}
            disabled={busy}
            placeholder="owner-id@synexus.local"
            onChange={(event) => setCommandId(event.target.value)}
          />
        </label>
        <label className="god-mode-login__field">
          <span>God mode key</span>
          <input
            type="password"
            autoComplete="current-password"
            value={commandKey}
            disabled={busy}
            placeholder="••••••••••••••••"
            onChange={(event) => setCommandKey(event.target.value)}
          />
        </label>
      </div>

      <button type="button" className="god-mode-login__submit" disabled={busy} onClick={() => void handleSubmit()}>
        {busy ? "Verifying…" : "Enter god mode"}
      </button>

      <p className="god-mode-login__footnote">
        Use your server-configured god mode ID and key — not your regular SyNexus sign-in email unless
        you set <code className="god-mode-login__code">SYNEXUS_OWNER_EMAIL</code> to match. Restart{" "}
        <code className="god-mode-login__code">npm run dev</code> after changing <code className="god-mode-login__code">.env</code>.
      </p>
    </section>
  );
}
