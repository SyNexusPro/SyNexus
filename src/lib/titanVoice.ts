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

const FEMALE_NAME =
  /\b(female|woman|zira|aria|jenny|samantha|sara|sarah|michelle|eva|susan|linda|hazel|libby|sonia|natasha|moira|fiona|karen|tessa|veena|raveena|catherine|heera|nova|shimmer|coral|cortana)\b/;
const MALE_NAME =
  /\b(male|man|david|mark|fred|daniel|james|guy|ryan|christopher|eric|steffan|roger|george|richard|tom|alex|adam|brian|matthew)\b/;

function voiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

function isUkVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  const label = voiceLabel(voice);
  return lang.startsWith("en-gb") || label.includes("uk english") || label.includes("british") || label.includes("en-gb");
}

function looksFemale(voice: SpeechSynthesisVoice): boolean {
  return FEMALE_NAME.test(voiceLabel(voice));
}

function looksMale(voice: SpeechSynthesisVoice): boolean {
  const label = voiceLabel(voice);
  return MALE_NAME.test(label) && !FEMALE_NAME.test(label);
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  const label = voiceLabel(voice);
  let score = lang.startsWith("en") ? 10 : 0;
  if (looksFemale(voice)) score += 48;
  if (looksMale(voice)) score -= 90;
  if (label.includes("aria")) score += 32;
  if (label.includes("jenny")) score += 26;
  if (label.includes("zira")) score += 22;
  if (label.includes("samantha")) score += 18;
  if (label.includes("eva")) score += 16;
  if (lang.startsWith("en-us") || label.includes("united states") || label.includes("us english") || label.includes("en-us")) {
    score += 20;
  }
  if (isUkVoice(voice)) score -= 36;
  if (label.includes("neural") || label.includes("natural") || label.includes("online")) score += 22;
  if (label.includes("google") && label.includes("us") && label.includes("english")) score += 18;
  if (label.includes("cortana")) score += 6;
  if (voice.localService) score += 2;
  for (const hint of TITAN_VOICE_PREFER) {
    if (label.includes(hint) || lang.includes(hint)) score += 10;
  }
  for (const avoid of TITAN_VOICE_AVOID) {
    if (label.includes(avoid)) score -= 28;
  }
  return score;
}

export function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedVoice;

  const english = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("en"));
  const female = english.filter((voice) => looksFemale(voice) && !looksMale(voice) && !isUkVoice(voice));
  const pool = female.length
    ? female
    : english.filter((voice) => !looksMale(voice) && !isUkVoice(voice));
  const ranked = [...(pool.length ? pool : english.length ? english : voices)].sort(
    (a, b) => scoreVoice(b) - scoreVoice(a),
  );
  const best = ranked.find((voice) => !looksMale(voice)) ?? ranked[0] ?? null;
  if (best && scoreVoice(best) > 0) {
    cachedVoice = best;
    return best;
  }
  return cachedVoice ?? voices.find((voice) => voice.lang.startsWith("en") && !looksMale(voice)) ?? null;
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
