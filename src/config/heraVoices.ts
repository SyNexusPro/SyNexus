/**
 * Selectable GPT-Live voices for Hera. Voice is a session-startup field, so
 * changing it restarts the live session.
 *
 * Hera's identity stays original: these are OpenAI voice timbres, not
 * impersonations of any character or real person.
 */

export type HeraVoiceOption = {
  /** OpenAI API voice name sent as `audio.output.voice`. */
  id: string;
  label: string;
  /** Short description of the timbre, for the picker. */
  note: string;
};

/** Feminine-presenting voices first — Hera's established range. */
export const HERA_VOICE_OPTIONS: readonly HeraVoiceOption[] = [
  { id: "marin", label: "Marin", note: "Default — warm American alto" },
  { id: "gleam", label: "Gleam", note: "North American, bright and even" },
  { id: "quartz", label: "Quartz", note: "Australian, crisp" },
  { id: "willow", label: "Willow", note: "Irish, soft" },
  { id: "delta", label: "Delta", note: "Southern US, relaxed" },
  { id: "bossa", label: "Bossa", note: "Brazilian Portuguese" },
  { id: "cedar", label: "Cedar", note: "Neutral, low and calm" },
  { id: "meridian", label: "Meridian", note: "North American, masculine" },
  { id: "vesper", label: "Vesper", note: "British, masculine" },
  { id: "ripple", label: "Ripple", note: "Australian, masculine" },
  { id: "stone", label: "Stone", note: "Irish, masculine" },
  { id: "tempo", label: "Tempo", note: "Brazilian Portuguese, masculine" },
  { id: "beacon", label: "Beacon", note: "Filipino English, masculine" },
  { id: "cinder", label: "Cinder", note: "Southern US, masculine" },
];

export const HERA_VOICE_IDS: readonly string[] = HERA_VOICE_OPTIONS.map((v) => v.id);

export const HERA_DEFAULT_VOICE = "marin";

/** Returns the voice if it is on the allowlist, otherwise null. */
export function normalizeHeraVoice(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  return HERA_VOICE_IDS.includes(raw) ? raw : null;
}
