import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { markRecentStepUp } from "../../security/mfa";
import {
  challengePhoneMfa,
  enrollPhoneMfa,
  listPhoneMfaFactors,
  maskPhoneNumber,
  PHONE_RESEND_SECONDS,
  unenrollPhoneFactor,
  verifyPhoneMfa,
} from "../../security/phoneVerification";

const COUNTRIES = [
  { code: "+1", label: "US/Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+91", label: "India (+91)" },
  { code: "+52", label: "Mexico (+52)" },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+33", label: "France (+33)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+63", label: "Philippines (+63)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+27", label: "South Africa (+27)" },
] as const;

type Step = "phone" | "code" | "success";

export function MfaSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath =
    typeof location.state === "object" &&
    location.state &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/pulse";
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState("+1");
  const [nationalNumber, setNationalNumber] = useState("");
  const [factorId, setFactorId] = useState("");
  const [factorInitiallyVerified, setFactorInitiallyVerified] = useState(false);
  const [changeAfterVerify, setChangeAfterVerify] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("your phone");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function sendChallenge(id: string) {
    const challenge = await challengePhoneMfa(id);
    setChallengeId(challenge);
    setCooldown(PHONE_RESEND_SECONDS);
    setDigits(["", "", "", "", "", ""]);
    setStep("code");
  }

  useEffect(() => {
    let alive = true;
    void listPhoneMfaFactors()
      .then(async (factors) => {
        if (!alive || !factors[0]) return;
        setFactorId(factors[0].id);
        setFactorInitiallyVerified(true);
        setMaskedPhone(maskPhoneNumber(factors[0].phone));
        await sendChallenge(factors[0].id);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not send the SMS code.");
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") inputs.current[0]?.focus();
  }, [step]);

  async function enrollAndSend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const localDigits = nationalNumber.replace(/\D/g, "").replace(/^0+/, "");
      const phone = `${country}${localDigits}`;
      const enrolled = await enrollPhoneMfa(phone);
      setFactorId(enrolled.factorId);
      setFactorInitiallyVerified(false);
      setMaskedPhone(maskPhoneNumber(enrolled.phone));
      await sendChallenge(enrolled.factorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  }

  function applyDigits(start: number, value: string) {
    const incoming = value.replace(/\D/g, "");
    if (!incoming) {
      setDigits((current) => current.map((digit, index) => (index === start ? "" : digit)));
      return;
    }
    setDigits((current) => {
      const next = [...current];
      incoming.slice(0, 6 - start).split("").forEach((digit, offset) => {
        next[start + offset] = digit;
      });
      return next;
    });
    inputs.current[Math.min(5, start + incoming.length)]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    applyDigits(0, event.clipboardData.getData("text"));
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
  }

  async function verifyCode() {
    if (busy || !factorId || !challengeId || digits.join("").length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneMfa(factorId, challengeId, digits.join(""));
      markRecentStepUp();
      if (changeAfterVerify) {
        await unenrollPhoneFactor(factorId);
        setFactorId("");
        setChallengeId("");
        setFactorInitiallyVerified(false);
        setChangeAfterVerify(false);
        setNationalNumber("");
        setDigits(["", "", "", "", "", ""]);
        setCooldown(0);
        setStep("phone");
        return;
      }
      setStep("success");
      window.setTimeout(() => navigate(returnPath, { replace: true }), 650);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || cooldown > 0 || !factorId) return;
    setBusy(true);
    setError(null);
    try {
      await sendChallenge(factorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  async function changePhone() {
    if (busy) return;
    if (factorInitiallyVerified) {
      setChangeAfterVerify(true);
      setError("Verify the current phone first, then you can securely enter a new number.");
      inputs.current[0]?.focus();
      return;
    }
    if (!window.confirm("Remove this phone enrollment and enter a different number?")) return;
    setBusy(true);
    setError(null);
    try {
      if (factorId) await unenrollPhoneFactor(factorId);
      setFactorId("");
      setChallengeId("");
      setNationalNumber("");
      setDigits(["", "", "", "", "", ""]);
      setCooldown(0);
      setStep("phone");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the phone number.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page synexus-sec">
      <section className="synexus-sec__card synexus-sec__phone-card" aria-labelledby="mfa-setup-title">
        <p className="synexus-sec__eyebrow">SyNexus Security</p>

        {step === "phone" ? (
          <>
            <h1 id="mfa-setup-title">Secure Your SyNexus Account</h1>
            <p className="synexus-sec__lede">
              Add your phone number to protect your account. We&apos;ll text you a 6-digit verification code.
            </p>
            {error ? <p className="synexus-sec__error" role="alert">{error}</p> : null}
            <label className="synexus-sec__label" htmlFor="mfa-country">Country</label>
            <select
              id="mfa-country"
              className="synexus-sec__input synexus-sec__country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              {COUNTRIES.map((item) => <option key={item.label} value={item.code}>{item.label}</option>)}
            </select>
            <label className="synexus-sec__label" htmlFor="mfa-phone">Mobile phone number</label>
            <div className="synexus-sec__phone-field">
              <span aria-hidden>{country}</span>
              <input
                id="mfa-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={nationalNumber}
                onChange={(event) => setNationalNumber(event.target.value.replace(/[^\d\s().-]/g, "").slice(0, 22))}
                placeholder="555 123 4567"
                aria-label="Mobile phone number"
              />
            </div>
            <button type="button" className="synexus-sec__btn" disabled={busy || nationalNumber.replace(/\D/g, "").length < 7} onClick={() => void enrollAndSend()}>
              {busy ? "Sending…" : "Send Verification Code"}
            </button>
          </>
        ) : null}

        {step === "code" ? (
          <>
            <h1 id="mfa-setup-title">Enter Verification Code</h1>
            <p className="synexus-sec__lede">We sent a 6-digit code to {maskedPhone}.</p>
            {error ? <p className="synexus-sec__error" role="alert">{error}</p> : null}
            <div className="synexus-sec__otp" aria-label="Six-digit SMS verification code">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputs.current[index] = node;
                  }}
                  className="synexus-sec__otp-box"
                  aria-label={`Verification code digit ${index + 1}`}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={index === 0 ? 6 : 1}
                  value={digit}
                  onChange={(event) => applyDigits(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                />
              ))}
            </div>
            <button type="button" className="synexus-sec__btn" disabled={busy || digits.join("").length !== 6} onClick={() => void verifyCode()}>
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
            <div className="synexus-sec__phone-actions">
              <button type="button" className="synexus-sec__text-btn" disabled={busy || cooldown > 0} onClick={() => void resendCode()}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
              </button>
              <button type="button" className="synexus-sec__text-btn" disabled={busy} onClick={() => void changePhone()}>
                Back / change phone number
              </button>
            </div>
          </>
        ) : null}

        {step === "success" ? (
          <div className="synexus-sec__verified" role="status">
            <span aria-hidden>✓</span>
            <strong>Phone verified ✓</strong>
            <p>Opening SyNexus…</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
