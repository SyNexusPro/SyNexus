/**
 * When has the speaker finished? Hera should wait through a thinking pause, and
 * should wait longer when the sentence plainly is not over ("and…", "so…", "um…").
 *
 * Pure functions only (no DOM) so the rules are easy to test and tune.
 */

export type HeraPatience = "quick" | "natural" | "patient";

export type HeraPatienceOption = {
  id: HeraPatience;
  label: string;
  note: string;
};

export const HERA_PATIENCE_OPTIONS: readonly HeraPatienceOption[] = [
  { id: "quick", label: "Quick", note: "Replies soon after you pause" },
  { id: "natural", label: "Natural", note: "Waits through short pauses (default)" },
  { id: "patient", label: "Patient", note: "Lets you think out loud without cutting in" },
];

export const HERA_DEFAULT_PATIENCE: HeraPatience = "natural";

type PatienceProfile = {
  /** Silence after a sentence that sounds complete. */
  finishedMs: number;
  /** Silence after a sentence that sounds unfinished. */
  unfinishedMs: number;
  /** Audio-only silence (recording path has no words to inspect). */
  recorderMs: number;
  /** Quiet gap that ends a turn in the live voice session. */
  liveTurnMs: number;
};

const PROFILES: Record<HeraPatience, PatienceProfile> = {
  quick: { finishedMs: 1200, unfinishedMs: 2400, recorderMs: 1500, liveTurnMs: 1000 },
  natural: { finishedMs: 1900, unfinishedMs: 4000, recorderMs: 2400, liveTurnMs: 1800 },
  patient: { finishedMs: 2800, unfinishedMs: 6500, recorderMs: 3600, liveTurnMs: 2800 },
};

/** No speech at all for this long: close the mic quietly instead of hanging open. */
export const HERA_NO_SPEECH_MS = 10_000;

/** A single push-to-talk recording never runs longer than this. */
export const HERA_MAX_RECORDING_MS = 120_000;

export function normalizeHeraPatience(value: string | null | undefined): HeraPatience | null {
  const raw = value?.trim().toLowerCase();
  if (raw === "quick" || raw === "natural" || raw === "patient") return raw;
  return null;
}

export function patienceProfile(patience: HeraPatience = HERA_DEFAULT_PATIENCE): PatienceProfile {
  return PROFILES[patience];
}

/** Words that almost never end a thought. */
const TRAILING_WORDS = new Set([
  "and", "but", "or", "so", "because", "cause", "then", "if", "when", "while", "that", "which", "who",
  "the", "a", "an", "to", "of", "for", "with", "in", "on", "at", "about", "like", "as", "than", "from",
  "by", "into", "also", "plus", "actually", "basically", "maybe", "well", "um", "uh", "umm", "uhh", "er",
  "hmm", "hm", "is", "are", "was", "were", "am", "be", "i", "i'm", "i'd", "i'll", "i've", "my", "your",
  "what", "whats", "what's", "how", "why", "where", "should", "could", "would", "can", "do", "does", "did",
  "will", "its", "it's", "this", "these", "those", "some", "any", "not", "no", "kind", "sort", "versus",
  "vs", "between", "whether", "buying", "selling", "checking", "looking", "thinking", "talking", "comparing",
  "let's", "lets", "wait", "hold", "either", "both",
]);

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[“”"()]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
    .filter(Boolean);
}

/** True when the transcript ends in a way that implies more is coming. */
export function soundsUnfinished(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return false;
  if (/[,;:\-–—…]$/.test(trimmed) || /\.\.\.$/.test(trimmed)) return true;
  if (/[.!?]$/.test(trimmed)) return false;
  const words = wordsOf(trimmed);
  const last = words[words.length - 1];
  if (!last) return false;
  return TRAILING_WORDS.has(last);
}

/** True when the transcript ends with sentence-final punctuation. */
export function soundsFinished(text: string): boolean {
  return /[.!?]["”)]?$/.test(text.replace(/\s+/g, " ").trim());
}

/**
 * How long to wait in silence before treating the transcript as the user's full turn.
 * Longer thoughts earn a little extra grace, since people pause more mid-thought.
 */
export function endpointDelayMs(text: string, patience: HeraPatience = HERA_DEFAULT_PATIENCE): number {
  const profile = patienceProfile(patience);
  const wordCount = wordsOf(text).length;
  const longBonus = Math.min(800, Math.max(0, wordCount - 12) * 40);
  if (soundsUnfinished(text)) return Math.round(profile.unfinishedMs + longBonus);
  if (soundsFinished(text)) return Math.round(Math.max(900, profile.finishedMs * 0.85) + longBonus * 0.5);
  return Math.round(profile.finishedMs + longBonus);
}

/** Audio-only silence needed to end a recording, growing slowly with how long the user has spoken. */
export function recorderSilenceMs(patience: HeraPatience, speechMs: number): number {
  const profile = patienceProfile(patience);
  const extra = Math.min(1200, Math.max(0, speechMs - 6000) * 0.12);
  return Math.round(profile.recorderMs + extra);
}

/** Quiet gap (no transcript fragments) that ends a user turn in the live voice session. */
export function liveTurnQuietMs(patience: HeraPatience = HERA_DEFAULT_PATIENCE): number {
  return patienceProfile(patience).liveTurnMs;
}

export type NoiseCalibration = {
  /** Level above which the mic counts as speech. */
  speechLevel: number;
  /** Level below which the mic counts as silence (hysteresis keeps soft words from flickering). */
  silenceLevel: number;
};

/**
 * Speech/silence thresholds relative to the room, so a quiet speaker in a quiet room
 * is heard and a noisy room does not hold the mic open forever.
 */
export function calibrateNoise(samples: readonly number[]): NoiseCalibration {
  const clean = samples.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  // Quietest quarter: if the user starts talking during calibration, their voice must not become "the room".
  const floor = clean.length ? clean[Math.floor((clean.length - 1) * 0.25)] ?? 0 : 0;
  const speechLevel = Math.min(0.16, Math.max(0.055, floor * 2.1 + 0.035));
  const silenceLevel = Math.min(speechLevel - 0.012, Math.max(0.03, floor * 1.45 + 0.018));
  return { speechLevel, silenceLevel };
}

/**
 * Extracts the first complete spoken sentence or clause without splitting inside
 * decimal numbers ("$1.24", "up 3.5%") or common abbreviations.
 */
export function firstSpokenSentence(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < 10) return null;

  // Match sentence-ending punctuation that is NOT between two digits (e.g. 1.24).
  const sentenceRe = /(?<!\d)[.!?…]+(?!\d)(?=\s|$)/g;
  for (const match of trimmed.matchAll(sentenceRe)) {
    const end = (match.index ?? 0) + match[0].length;
    if (end >= 12 && end <= 220) {
      return trimmed.slice(0, end).trim();
    }
  }

  // Fallback to a natural comma/dash clause once enough words have streamed.
  if (trimmed.length >= 48) {
    const clause = trimmed.match(/^[\s\S]{18,150}?[,;—–](?=\s)/);
    if (clause) return clause[0].trim();
  }
  if (trimmed.length >= 90) {
    const slice = trimmed.slice(0, 110);
    const cut = slice.lastIndexOf(" ");
    return (cut > 24 ? slice.slice(0, cut) : slice).trim();
  }
  return null;
}

