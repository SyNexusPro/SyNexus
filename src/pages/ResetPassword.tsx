import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordRevealToggle } from "../components/PasswordRevealToggle";
import { validateSignupPassword } from "../lib/authCredentials";
import { describeAuthError } from "../lib/authErrors";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import { updatePassword } from "../lib/supabaseData";

export function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setMessage({ tone: "error", text: "Sign-in is not configured on this server." });
      return;
    }

    let alive = true;

    const markReady = () => {
      if (alive) setReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        markReady();
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSave() {
    if (busy) return;
    if (password !== confirm) {
      setMessage({ tone: "error", text: "Passwords do not match." });
      return;
    }
    const check = validateSignupPassword(password);
    if (!check.ok) {
      setMessage({ tone: "error", text: check.message ?? "Choose a stronger password." });
      return;
    }

    setBusy(true);
    setMessage({ tone: "info", text: "Saving your new password…" });
    try {
      await updatePassword(password);
      setPassword("");
      setConfirm("");
      setMessage({ tone: "success", text: "Password updated. You can sign in with your new password." });
      window.setTimeout(() => navigate("/pulse", { replace: true }), 800);
    } catch (err) {
      setMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--command">
      <section className="operator-link" aria-label="Reset password">
        <header className="operator-link__head">
          <p className="operator-link__eyebrow">Account recovery</p>
          <h1 className="operator-link__title">Choose a new password</h1>
          <p className="operator-link__lede">
            Open this page from the reset link in your email. Use at least 10 characters with letters and numbers.
          </p>
        </header>

        {message ? (
          <p className={`operator-link__message operator-link__message--${message.tone}`} role="status">
            {message.text}
          </p>
        ) : null}

        {!ready ? (
          <p className="operator-link__loading" role="status">
            Confirming your reset link…
          </p>
        ) : (
          <form
            className="operator-link__fields"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <label className="operator-link__field">
              <span>New password</span>
              <div className="operator-link__password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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
            </label>
            <label className="operator-link__field">
              <span>Confirm password</span>
              <div className="operator-link__password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  disabled={busy}
                  placeholder="••••••••••"
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
            </label>
            <button type="submit" className="operator-link__submit" disabled={busy || !password || !confirm}>
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}

        <p className="operator-link__footnote">
          <Link to="/pulse">Back to sign in</Link>
        </p>
      </section>
    </div>
  );
}
