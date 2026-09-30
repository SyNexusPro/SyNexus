import { useEffect, useState } from "react";
import { useHeraWakeWordSetting } from "../hooks/useHeraWakeWordSetting";
import { unlockTitanSpeech } from "../lib/titanVoice";
import { HERA_VOICE_OPTIONS } from "../config/heraVoices";
import { getHeraVoicePreference, setHeraVoicePreference } from "../lib/hera/heraVoicePreference";
import { heraLiveVoice } from "../services/heraVoice";

/** Pulse / settings control for Listen after it leaves the bottom nav. */
export function HeraListenSettings() {
  const { enabled, permission, toggle } = useHeraWakeWordSetting();
  const [voice, setVoice] = useState<string>(() => getHeraVoicePreference() ?? "");
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const denied = permission === "denied";
  const unsupported = permission === "unsupported";

  useEffect(() => {
    if (!voiceNote) return;
    const timer = window.setTimeout(() => setVoiceNote(null), 4000);
    return () => window.clearTimeout(timer);
  }, [voiceNote]);

  function chooseVoice(next: string) {
    setVoice(next);
    setHeraVoicePreference(next || null);
    void heraLiveVoice.restartSession().then((restarted) => {
      setVoiceNote(
        restarted
          ? "New voice applied — Hera reconnected."
          : "Saved. Hera uses this voice the next time she opens.",
      );
    });
  }

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

      <label className="hera-listen-settings__field">
        <span>Hera voice</span>
        <select value={voice} onChange={(event) => chooseVoice(event.target.value)}>
          <option value="">Server default</option>
          {HERA_VOICE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} — {option.note}
            </option>
          ))}
        </select>
      </label>
      {voiceNote ? (
        <p className="hera-listen-settings__lede" role="status">
          {voiceNote}
        </p>
      ) : null}
    </section>
  );
}
