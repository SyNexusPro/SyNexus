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

function isUkVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  const label = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return (
    lang.startsWith("en-gb") ||
    label.includes("uk english") ||
    label.includes("british") ||
    label.includes("en-gb") ||
    /\b(sonia|libby|hazel)\b/.test(label)
  );
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  const label = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = lang.startsWith("en") ? 10 : 0;
  if (label.includes("cortana")) score += 80;
  if (label.includes("eva")) score += 36;
  if (lang.startsWith("en-us") || label.includes("united states") || label.includes("us english") || label.includes("en-us")) score += 24;
  if (isUkVoice(voice)) score -= 48;
  if (label.includes("neural") || label.includes("natural")) score += 14;
  if (label.includes("aria")) score += 28;
  if (label.includes("jenny")) score += 8;
  if (label.includes("samantha")) score += 10;
  if (label.includes("google") && label.includes("us") && label.includes("english")) score += 16;
  if (voice.localService) score += 1;
  for (const hint of TITAN_VOICE_PREFER) {
    if (label.includes(hint) || lang.includes(hint)) score += 12;
  }
  for (const avoid of TITAN_VOICE_AVOID) {
    if (label.includes(avoid)) score -= 24;
  }
  return score;
}

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedVoice;
  cachedVoice = null;

  const usVoices = voices.filter((voice) => {
    const lang = voice.lang.toLowerCase().replace("_", "-");
    const label = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    return lang.startsWith("en-us") || label.includes("us english") || label.includes("cortana") || label.includes("aria") || label.includes("jenny");
  });
  const pool = usVoices.length ? usVoices.filter((v) => !isUkVoice(v)) : voices.filter((v) => !isUkVoice(v));
  const ranked = [...(pool.length ? pool : voices)].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  const best = ranked[0] ?? null;
  if (best && scoreVoice(best) > 0) {
    cachedVoice = best;
    return best;
  }
  return cachedVoice ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

export function warmTitanVoices(): void {
  ensureVoicesLoaded();
}

function ensureVoicesLoaded(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
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

/** Call from a tap so later speechSynthesis is allowed. Does not take the mic. */
export function unlockTitanSpeech(): void {
  setTitanVoiceEnabled(true);
  if (!isTitanVoiceSupported()) return;
  ensureVoicesLoaded();
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    void ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* ignore */
  }
}

export function isTitanSpeaking(): boolean {
  return isTitanVoiceSupported() && window.speechSynthesis.speaking;
}

function playUtterance(
  spoken: string,
  handlers?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
    onBoundary?: (word: string) => void;
  },
): void {
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
  utterance.onboundary = (event) => {
    if (event.name === "sentence") return;
    const idx = Math.max(0, event.charIndex || 0);
    if (event.name !== "word" && idx > 0 && !/\s/.test(spoken[idx - 1] ?? " ")) return;
    const from = spoken.slice(idx);
    const word = from.split(/\s+/)[0]?.replace(/[^\w']/g, "") ?? "";
    if (word) handlers?.onBoundary?.(word);
  };
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }
  window.speechSynthesis.speak(utterance);
}

export function speakTitan(
  text: string,
  handlers?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
    onBoundary?: (word: string) => void;
  },
): void {
  if (!isTitanVoiceSupported() || !hasTitanVoiceEnabled()) return;

  const spoken = textForTitanSpeech(text);
  if (!spoken) return;

  ensureVoicesLoaded();
  stopTitanSpeech();

  if (!voicesReady && !window.speechSynthesis.getVoices().length) {
    let played = false;
    const retry = () => {
      if (played) return;
      played = true;
      window.speechSynthesis.removeEventListener("voiceschanged", retry);
      playUtterance(spoken, handlers);
    };
    window.speechSynthesis.addEventListener("voiceschanged", retry);
    window.setTimeout(retry, 450);
    return;
  }

  playUtterance(spoken, handlers);
}
