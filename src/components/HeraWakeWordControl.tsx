import { useTranslation } from "react-i18next";
import { useTitanChatOpen } from "../hooks/useTitanChatOpen";
import { useHeraWakeWordSetting } from "../hooks/useHeraWakeWordSetting";
import { openTitanChat } from "../lib/openOracleLogin";
import { unlockTitanSpeech } from "../lib/titanVoice";
import { dockHeraListenToSettings } from "../lib/hera/wakeWord";

/**
 * Bottom-nav Listen control. Turns wake-word listening on/off.
 * Does not open Hera unless the microphone is denied/unavailable (type fallback).
 */
export function HeraWakeWordControl() {
  const { t } = useTranslation();
  const heraOpen = useTitanChatOpen();
  const { enabled, permission, toggle } = useHeraWakeWordSetting();

  const denied = permission === "denied";
  const unsupported = permission === "unsupported";
  const listening = enabled && !denied && !unsupported && !heraOpen;

  function handleClick() {
    if (denied || unsupported) {
      openTitanChat();
      return;
    }
    unlockTitanSpeech();
    dockHeraListenToSettings();
    toggle();
  }

  const label = denied ? "Type" : unsupported ? "Hera" : t("nav.listen");
  const hint = denied
    ? "Microphone blocked — tap to type to Hera"
    : unsupported
      ? "Wake word unavailable — tap to type to Hera"
      : enabled
        ? "Listening for “Hera” or “Titan”. Tap to turn off."
        : "Tap to listen for “Hera” or “Titan”";

  return (
    <button
      type="button"
      className={`bottom-nav__link${listening || heraOpen ? " is-active" : ""}`}
      data-tour="nav-listen"
      onClick={handleClick}
      aria-pressed={enabled && !denied}
      aria-label={hint}
      title={hint}
    >
      <span className="bottom-nav__icon bottom-nav__icon--listen" aria-hidden>
        {listening ? "◉" : "◎"}
      </span>
      {label}
    </button>
  );
}
