/** Hera / Titan spoken voice — original character, not a clone of any copyrighted AI. */

export const TITAN_VOICE_ENABLED_KEY = "synexus_titan_voice_enabled";

/** Calm, present, slightly bright American AI — original Hera, not a named actor. */
export const TITAN_VOICE_RATE = 1.0;
export const TITAN_VOICE_PITCH = 1.08;
export const TITAN_VOICE_VOLUME = 1;

/** Prefer US neural female voices (case-insensitive). Do not target a copyrighted character. */
export const TITAN_VOICE_PREFER = [
  "microsoft aria",
  "aria online",
  "aria",
  "united states",
  "google us english",
  "samantha",
  "jenny",
  "en-us",
  "neural",
  "natural",
  "online",
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
  "zira",
  "sonia",
  "libby",
  "hazel",
  "uk english",
  "en-gb",
  "british",
  "espeak",
  "compact",
] as const;

/** Lines for the system prompt — text should match how she sounds. */
export const TITAN_VOICE_PERSONA =
  "Speak as Hera: a calm, intelligent, feminine AI. Confident, warm, slightly synthetic and futuristic. " +
  "Emotionally responsive but never theatrical. You are an original character — do not imitate any copyrighted character, game AI, or voice actor. " +
  "Clear conversational American English. Short, present sentences. You know more than you say.";
