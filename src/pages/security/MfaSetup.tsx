import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enrollTotpFactor, listVerifiedTotpFactors, MFA_VERIFY_PATH, verifyTotpCode } from "../../security/mfa";
import { recordSecurityEvent } from "../../security/securityEvents";

export function MfaSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    void listVerifiedTotpFactors()
      .then((existing) => {
        if (!alive) return;
        if (existing.length) {
          navigate("/security/verify", { replace: true });
          return;
        }
        return enrollTotpFactor("SyNexus Authenticator").then((enrolled) => {
          if (!alive) return;
          setFactorId(enrolled.factorId);
          setQrCode(enrolled.qrCode);
          setSecret(enrolled.secret);
          setStep(1);
        });
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not start setup.");
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  async function handleVerify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyTotpCode(factorId, code);
      void recordSecurityEvent({ eventType: "mfa_enrolled", success: true });
      void recordSecurityEvent({ eventType: "mfa_success", success: true });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page synexus-sec">
      <section className="synexus-sec__card" aria-labelledby="mfa-setup-title">
        <p className="synexus-sec__eyebrow">Security Setup</p>
        <h1 id="mfa-setup-title">Protect Your SyNexus Account</h1>
        <p className="synexus-sec__lede">SyNexus uses two-step verification to protect your account.</p>

        {step < 3 ? (
          <ol className="synexus-sec__steps">
            <li className={step === 1 ? "is-active" : ""}>Step 1 · Scan QR code</li>
            <li className={step === 2 ? "is-active" : ""}>Step 2 · Enter six-digit code</li>
            <li>Step 3 · Security enabled</li>
          </ol>
        ) : null}

        {error ? <p className="synexus-sec__error">{error}</p> : null}

        {step === 1 ? (
          <>
            <p>Scan this code with Google Authenticator, Microsoft Authenticator, Authy, or 1Password.</p>
            {qrCode ? (
              <img className="synexus-sec__qr" src={qrCode} alt="Authenticator QR code" />
            ) : (
              <p>{busy ? "Preparing authenticator…" : "QR code unavailable. Use the secret below."}</p>
            )}
            {secret ? (
              <p className="synexus-sec__secret">
                Manual secret: <code>{secret}</code>
              </p>
            ) : null}
            <button
              type="button"
              className="synexus-sec__btn"
              disabled={busy || !factorId}
              onClick={() => setStep(2)}
            >
              Set Up Authenticator
            </button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <label className="synexus-sec__label" htmlFor="mfa-setup-code">
              Enter the 6-digit code
            </label>
            <input
              id="mfa-setup-code"
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
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="synexus-sec__success">Security enabled. Your account now requires two-step verification.</p>
            <button type="button" className="synexus-sec__btn" onClick={() => navigate("/pulse", { replace: true })}>
              Continue
            </button>
          </>
        ) : null}

        <p className="synexus-sec__foot">
          Already set up? <Link to={MFA_VERIFY_PATH}>Verify a code</Link>
        </p>
      </section>
    </div>
  );
}
