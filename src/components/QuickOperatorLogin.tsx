import { useMemo, useState } from "react";
import { passwordStrengthLabel, validateSignupPassword } from "../lib/authCredentials";
import { loadRememberedEmail, saveRememberedEmail } from "../lib/authRemember";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import {
  signInWithEmail,
  signOut,
  signUpWithEmail,
  upsertSignupProfile,
} from "../lib/supabaseData";
import { useOperatorAuth } from "../hooks/useOperatorAuth";

const DEMO_SESSION_KEY = "hivemind_demo_session";

type Props = {
  onSuccess?: () => void;
  compact?: boolean;
};

function describeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_grant")) {
    return "Wrong email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Check your inbox — confirm your email before signing in.";
  }
  if (lower.includes("too many requests") || lower.includes("rate")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (lower.includes("user already registered")) {
    return "Account exists — switch to Sign in.";
  }
  return msg || "Something went wrong. Try again.";
}

export function QuickOperatorLogin({ onSuccess, compact = false }: Props) {
  const { linked } = useOperatorAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(() => loadRememberedEmail() ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    setMessage({ tone: "info", text: mode === "signup" ? "Creating account…" : "Signing in…" });

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
        setMessage({
          tone: "success",
          text: user
            ? "Welcome — you're signed in."
            : `Check ${trimmedEmail} to verify your email, then sign in.`,
        });
        if (user && result.session) {
          onSuccess?.();
        }
        return;
      }

      await signInWithEmail(trimmedEmail, password);
      saveRememberedEmail(trimmedEmail);
      setPassword("");
      setMessage({ tone: "success", text: "Signed in." });
      onSuccess?.();
    } catch (err) {
      setMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setBusy(false);
    }
  }

  if (linked) {
    return (
      <div className="quick-login quick-login--linked">
        <p className="quick-login__linked">You&apos;re signed in.</p>
        <button type="button" className="quick-login__submit" onClick={onSuccess}>
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
    <section className={`quick-login${compact ? " quick-login--compact" : ""}`} aria-label="Sign in">
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

      {message ? (
        <p className={`quick-login__message quick-login__message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="quick-login__fields">
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
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            disabled={busy}
            placeholder="••••••••••"
            onChange={(event) => setPassword(event.target.value)}
          />
          {passwordHint ? <span className="quick-login__hint">{passwordHint}</span> : null}
        </label>
      </div>

      <button type="button" className="quick-login__submit" disabled={busy} onClick={() => void handleSubmit()}>
        {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </section>
  );
}
