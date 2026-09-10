import {
  TITAN_VOICE_AVOID,
  TITAN_VOICE_PITCH,
  TITAN_VOICE_PREFER,
  TITAN_VOICE_RATE,
  TITAN_VOICE_VOLUME,
} from "../config/titanVoice";
import { textForTitanSpeech } from "./titanVoice";

let cachedVoice: SpeechSynthesisVoice | null = null;

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const label = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = voice.lang.toLowerCase().startsWith("en") ? 10 : 0;
  if (voice.localService) score += 2;
  for (const hint of TITAN_VOICE_PREFER) {
    if (label.includes(hint)) score += 12;
  }
  for (const avoid of TITAN_VOICE_AVOID) {
    if (label.includes(avoid)) score -= 20;
  }
  return score;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedVoice;
  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  const best = ranked[0] ?? null;
  if (best && scoreVoice(best) > 0) {
    cachedVoice = best;
    return best;
  }
  return cachedVoice ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

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
  cachedVoice = pickVoice();

  const utterance = new SpeechSynthesisUtterance(spoken);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = TITAN_VOICE_RATE;
  utterance.pitch = TITAN_VOICE_PITCH;
  utterance.volume = TITAN_VOICE_VOLUME;

  utterance.onstart = () => handlers?.onStart?.();
  utterance.onend = () => handlers?.onEnd?.();
  utterance.onerror = () => handlers?.onError?.();

  window.speechSynthesis.speak(utterance);
}
