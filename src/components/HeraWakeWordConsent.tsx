import { HERA_WAKE_CONSENT_COPY } from "../config/heraWakeWord";
import { useHeraWakeWordSetting } from "../hooks/useHeraWakeWordSetting";

export function HeraWakeWordConsent() {
  const { consentOpen, acceptConsent, declineConsent } = useHeraWakeWordSetting();
  if (!consentOpen) return null;

  return (
    <div className="hera-wake-consent" role="dialog" aria-labelledby="hera-wake-consent-title" aria-modal="true">
      <div className="hera-wake-consent__card">
        <p className="hera-wake-consent__eyebrow">Microphone</p>
        <h2 id="hera-wake-consent-title">{HERA_WAKE_CONSENT_COPY.title}</h2>
        <p>{HERA_WAKE_CONSENT_COPY.body}</p>
        <div className="hera-wake-consent__actions">
          <button type="button" className="hera-wake-consent__go" onClick={acceptConsent}>
            {HERA_WAKE_CONSENT_COPY.confirm}
          </button>
          <button type="button" className="hera-wake-consent__no" onClick={declineConsent}>
            {HERA_WAKE_CONSENT_COPY.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
