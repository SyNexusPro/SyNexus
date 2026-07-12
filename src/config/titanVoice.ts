/** Titan voice persona — soft, female, futuristic commander. */

export const TITAN_VOICE_ENABLED_KEY = "synexus_titan_voice_enabled";

/** Web Speech synthesis tuning (soft + slightly elevated = futuristic clarity). */
export const TITAN_VOICE_RATE = 0.91;
export const TITAN_VOICE_PITCH = 1.08;
export const TITAN_VOICE_VOLUME = 1;

/** Prefer these substrings when picking a system voice (case-insensitive). */
export const TITAN_VOICE_PREFER = [
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "alice",
  "zira",
  "jenny",
  "aria",
  "emma",
  "sonia",
  "libby",
  "female",
  "woman",
  "google uk english female",
] as const;

export const TITAN_VOICE_AVOID = [
  "male",
  "david",
  "fred",
  "daniel",
  "james",
  "guy",
  "ryan",
  "christopher",
  "eric",
  "steffan",
  "roger",
  "mark",
] as const;

/** Lines for the system prompt — text should match how she sounds. */
export const TITAN_VOICE_PERSONA =
  "Speak as a female intelligence commander: soft and calm in tone, but precise and futuristic in mind — " +
  "like a trusted AI partner from the near future. Warm, never harsh; confident, never robotic.";
