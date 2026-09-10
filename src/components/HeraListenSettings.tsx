import { useHeraWakeWordSetting } from "../hooks/useHeraWakeWordSetting";
import { unlockTitanSpeech } from "../lib/titanVoice";

/** Pulse / settings control for Listen after it leaves the bottom nav. */
export function HeraListenSettings() {
  const { enabled, permission, toggle } = useHeraWakeWordSetting();
  const denied = permission === "denied";
  const unsupported = permission === "unsupported";

  return (
    <section className="hera-listen-settings" id="hera-listen" aria-labelledby="hera-listen-title">
      <h2 id="hera-listen-title" className="hera-listen-settings__title">
        Hera Listen
      </h2>
      <p className="hera-listen-settings__lede">
        {denied
          ? "Microphone is blocked in this browser. Allow the mic to listen for “Hera”."
          : unsupported
            ? "Wake-word listening is not available on this device."
            : "While SyNexus is open, listen for “Hera” or “Titan”. Turn this off anytime."}
      </p>
      <label className="titan-chat-settings__toggle">
        <input
          type="checkbox"
          checked={enabled && !denied && !unsupported}
          disabled={denied || unsupported}
          onChange={() => {
            unlockTitanSpeech();
            toggle();
          }}
        />
        <span>Listen for “Hera”</span>
      </label>
    </section>
  );
}
