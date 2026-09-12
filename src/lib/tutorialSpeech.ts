import {
  TITAN_VOICE_PITCH,
  TITAN_VOICE_RATE,
  TITAN_VOICE_VOLUME,
} from "../config/titanVoice";
import { pickFemaleVoice, textForTitanSpeech } from "./titanVoice";

export function isTutorialSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function stopTutorialSpeech(): void {
  if (!isTutorialSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakTutorial(
  text: string,
  handlers?: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
): void {
  if (!isTutorialSpeechSupported()) {
    handlers?.onEnd?.();
    return;
  }

  const spoken = textForTitanSpeech(text);
  if (!spoken) {
    handlers?.onEnd?.();
    return;
  }

  stopTutorialSpeech();

  const utterance = new SpeechSynthesisUtterance(spoken);
  const voice = pickFemaleVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-US";
  utterance.rate = TITAN_VOICE_RATE;
  utterance.pitch = TITAN_VOICE_PITCH;
  utterance.volume = TITAN_VOICE_VOLUME;

  utterance.onstart = () => handlers?.onStart?.();
  utterance.onend = () => handlers?.onEnd?.();
  utterance.onerror = () => handlers?.onError?.();

  window.speechSynthesis.speak(utterance);
}
