/** Hera / Titan spoken voice — original character, not a clone of any copyrighted AI. */

export const TITAN_VOICE_ENABLED_KEY = "synexus_titan_voice_enabled";

/** Slightly slower and closer to natural pitch so she sounds smooth, not metallic. */
export const TITAN_VOICE_RATE = 0.92;
export const TITAN_VOICE_PITCH = 1.04;
export const TITAN_VOICE_VOLUME = 1;

/** Prefer warm US neural female voices (case-insensitive). */
export const TITAN_VOICE_PREFER = [
  "microsoft aria",
  "aria online",
  "aria",
  "microsoft jenny",
  "jenny",
  "microsoft zira",
  "zira",
  "google us english",
  "samantha",
  "sara",
  "sarah",
  "michelle",
  "susan",
  "female",
  "united states",
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
  "george",
  "richard",
  "tom",
  "alex",
  "uk english",
  "en-gb",
  "british",
  "espeak",
  "compact",
] as const;

/** Lines for the system prompt — text should match how she sounds. */
export const TITAN_VOICE_PERSONA =
  "Speak as Hera: a calm, intelligent, feminine AI. Warm alto, smooth and clear. " +
  "Emotionally responsive but never theatrical. You are an original character — do not imitate any copyrighted character, game AI, or voice actor. " +
  "Clear conversational American English. Short, present sentences. You know more than you say.";
