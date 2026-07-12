import {
  TITAN_VOICE_AVOID,
  TITAN_VOICE_ENABLED_KEY,
  TITAN_VOICE_PITCH,
  TITAN_VOICE_PREFER,
  TITAN_VOICE_RATE,
  TITAN_VOICE_VOLUME,
} from "../config/titanVoice";

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

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

function pickFemaleVoice(): SpeechSynthesisVoice | null {
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

function ensureVoicesLoaded(): void {
  if (voicesReady || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = pickFemaleVoice();
    voicesReady = true;
  };
  cachedVoice = pickFemaleVoice();
  if (window.speechSynthesis.getVoices().length) voicesReady = true;
}

export function isTitanVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function hasTitanVoiceEnabled(): boolean {
  try {
    return localStorage.getItem(TITAN_VOICE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTitanVoiceEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(TITAN_VOICE_ENABLED_KEY, "1");
    } else {
      localStorage.removeItem(TITAN_VOICE_ENABLED_KEY);
      stopTitanSpeech();
    }
  } catch {
    /* ignore */
  }
}

/** Strip markdown-ish noise before TTS. */
export function textForTitanSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/[#*_`]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 1200);
}

export function stopTitanSpeech(): void {
  if (!isTitanVoiceSupported()) return;
  window.speechSynthesis.cancel();
}

export function isTitanSpeaking(): boolean {
  return isTitanVoiceSupported() && window.speechSynthesis.speaking;
}

export function speakTitan(
  text: string,
  handlers?: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
): void {
  if (!isTitanVoiceSupported() || !hasTitanVoiceEnabled()) return;

  const spoken = textForTitanSpeech(text);
  if (!spoken) return;

  ensureVoicesLoaded();
  stopTitanSpeech();

  const utterance = new SpeechSynthesisUtterance(spoken);
  const voice = pickFemaleVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = TITAN_VOICE_RATE;
  utterance.pitch = TITAN_VOICE_PITCH;
  utterance.volume = TITAN_VOICE_VOLUME;

  utterance.onstart = () => handlers?.onStart?.();
  utterance.onend = () => handlers?.onEnd?.();
  utterance.onerror = () => handlers?.onError?.();

  window.speechSynthesis.speak(utterance);
}
