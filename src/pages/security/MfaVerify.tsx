import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listVerifiedTotpFactors, MFA_SETUP_PATH, verifyTotpCode } from "../../security/mfa";
import { recordSecurityEvent } from "../../security/securityEvents";

export function MfaVerify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stepUp = params.get("stepup") === "1";
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listVerifiedTotpFactors().then((factors) => {
      if (!alive) return;
      if (!factors[0]) {
        navigate(MFA_SETUP_PATH, { replace: true });
        return;
      }
      setFactorId(factors[0].id);
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  async function handleVerify() {
    if (busy || !factorId) return;
    setBusy(true);
    setError(null);
    try {
      await verifyTotpCode(factorId, code);
      void recordSecurityEvent({ eventType: "mfa_success", success: true });
      navigate(stepUp ? "/security" : "/pulse", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page synexus-sec">
      <section className="synexus-sec__card" aria-labelledby="mfa-verify-title">
        <p className="synexus-sec__eyebrow">Two-step verification</p>
        <h1 id="mfa-verify-title">Verify It&apos;s You</h1>
        <p className="synexus-sec__lede">Enter the 6-digit code from your authenticator app.</p>
        {error ? <p className="synexus-sec__error">{error}</p> : null}
        <label className="synexus-sec__label" htmlFor="mfa-verify-code">
          Authenticator code
        </label>
        <input
          id="mfa-verify-code"
          className="synexus-sec__code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <button type="button" className="synexus-sec__btn" disabled={busy || code.length !== 6} onClick={() => void handleVerify()}>
          {busy ? "Verifying…" : "Verify"}
        </button>
        <p className="synexus-sec__foot">
          Need to enroll? <Link to={MFA_SETUP_PATH}>Set up authenticator</Link>
        </p>
      </section>
    </div>
  );
}
