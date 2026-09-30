import { Link, useNavigate } from "react-router-dom";
import { PasswordRecoveryPanel } from "../components/PasswordRecoveryPanel";
import { loadRememberedEmail } from "../lib/authRemember";
import { hasSupabaseEnv } from "../lib/supabaseClient";

export function ResetPassword() {
  const navigate = useNavigate();

  return (
    <div className="page page--command">
      {hasSupabaseEnv ? (
        <PasswordRecoveryPanel
          initialEmail={loadRememberedEmail()}
          onFinished={() => navigate("/pulse", { replace: true })}
          onCancel={() => navigate("/pulse", { replace: true })}
        />
      ) : (
        <section className="operator-link" aria-label="Reset password">
          <header className="operator-link__head">
            <p className="operator-link__eyebrow">Account recovery</p>
            <h1 className="operator-link__title">Reset your password</h1>
          </header>
          <p className="operator-link__message operator-link__message--error" role="status">
            Sign-in is not configured on this server.
          </p>
          <p className="operator-link__footnote">
            <Link to="/pulse">Back to sign in</Link>
          </p>
        </section>
      )}
    </div>
  );
}
