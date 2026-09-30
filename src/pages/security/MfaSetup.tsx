import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { markRecentStepUp } from "../../security/mfa";
import {
  getFreshAuthUser,
  isPhoneVerified,
  maskPhoneNumber,
  PHONE_RESEND_SECONDS,
  sendPhoneVerificationSms,
  verifyPhoneSmsCode,
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
    typeof location.state.from === "string" &&
    location.state.from !== "/security/setup"
      ? location.state.from
      : "/pulse";
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyingRef = useRef(false);
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState("+1");
  const [nationalNumber, setNationalNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getFreshAuthUser().then((user) => {
      if (alive && isPhoneVerified(user)) navigate(returnPath, { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate, returnPath]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") inputs.current[0]?.focus();
  }, [step]);

  function composedPhone(): string {
    let localDigits = nationalNumber.replace(/\D/g, "").replace(/^0+/, "");
    const countryDigits = country.slice(1);
    if (localDigits.startsWith(countryDigits) && localDigits.length - countryDigits.length >= 7) {
      localDigits = localDigits.slice(countryDigits.length);
    }
    return `${country}${localDigits}`;
  }

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus("Sending a 6-digit code by SMS…");
    try {
      const confirmed = await sendPhoneVerificationSms(composedPhone());
      setPhone(confirmed);
      setDigits(["", "", "", "", "", ""]);
      setCooldown(PHONE_RESEND_SECONDS);
      setStep("code");
      setStatus("Code sent. Check your texts.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the verification code.");
      setStatus(null);
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
    const next = Array.from({ length: 6 }, (_, index) => digits[index] ?? "");
    incoming.slice(0, 6 - start).split("").forEach((digit, offset) => {
      next[start + offset] = digit;
    });
    setDigits(next);
    inputs.current[Math.min(5, start + incoming.length)]?.focus();
    if (next.join("").length === 6) {
      window.setTimeout(() => {
        void confirmCode(next.join(""));
      }, 0);
    }
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

  async function confirmCode(rawCode = digits.join("")) {
    if (verifyingRef.current || busy) return;
    const code = rawCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setError("Enter the complete 6-digit verification code.");
      return;
    }
    verifyingRef.current = true;
    setBusy(true);
    setError(null);
    setStatus("Verifying your code…");
    try {
      await verifyPhoneSmsCode(phone || composedPhone(), code);
      markRecentStepUp();
      setStatus(null);
      setStep("success");
      window.setTimeout(() => navigate(returnPath, { replace: true }), 650);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That verification code is invalid.");
      setStatus(null);
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || cooldown > 0) return;
    await sendCode();
  }

  const canSend = nationalNumber.replace(/\D/g, "").length >= 7;

  return (
    <div className="page synexus-sec">
      <section className="synexus-sec__card synexus-sec__phone-card" aria-labelledby="mfa-setup-title">
        <p className="synexus-sec__eyebrow">SyNexus Security</p>

        {step === "phone" ? (
          <>
            <h1 id="mfa-setup-title">Verify Your Phone</h1>
            <p className="synexus-sec__lede">
              After signing in, add your mobile number. We&apos;ll text a 6-digit code through Supabase to protect your account.
            </p>
            {error ? <p className="synexus-sec__error" role="alert">{error}</p> : null}
            {status ? <p className="synexus-sec__note" role="status">{status}</p> : null}
            <form onSubmit={(event) => void sendCode(event)}>
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
              <button
                type="submit"
                className="synexus-sec__btn"
                disabled={busy || !canSend}
                onClick={() => {
                  if (!canSend) setError("Enter a valid mobile number, then tap Send Verification Code.");
                }}
              >
                {busy ? "Sending…" : "Send Verification Code"}
              </button>
            </form>
          </>
        ) : null}

        {step === "code" ? (
          <>
            <h1 id="mfa-setup-title">Enter Verification Code</h1>
            <p className="synexus-sec__lede">We sent a 6-digit code to {maskPhoneNumber(phone)}.</p>
            {error ? <p className="synexus-sec__error" role="alert">{error}</p> : null}
            {status ? <p className="synexus-sec__note" role="status">{status}</p> : null}
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
            <button
              type="button"
              className="synexus-sec__btn"
              disabled={busy || digits.join("").length !== 6}
              onClick={() => void confirmCode()}
            >
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
            <div className="synexus-sec__phone-actions">
              <button type="button" className="synexus-sec__text-btn" disabled={busy || cooldown > 0} onClick={() => void resendCode()}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
              </button>
              <button
                type="button"
                className="synexus-sec__text-btn"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setStatus(null);
                  setDigits(["", "", "", "", "", ""]);
                  setStep("phone");
                }}
              >
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
