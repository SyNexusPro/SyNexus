/** Natural female neural voice — override with VIDEO_TTS_VOICE in .env */

export const DEFAULT_TTS_VOICE =
  process.env.VIDEO_TTS_VOICE?.trim() || "en-US-AriaNeural";

const FEMALE_VOICES = new Set([
  "en-US-AriaNeural",
  "en-US-JennyNeural",
  "en-US-AvaNeural",
  "en-US-EmmaNeural",
  "en-US-AnaNeural",
  "en-US-MichelleNeural",
  "en-GB-SoniaNeural",
]);

export function resolveTtsVoice(requested) {
  const v = requested?.trim() || DEFAULT_TTS_VOICE;
  return FEMALE_VOICES.has(v) || v.includes("Neural") ? v : DEFAULT_TTS_VOICE;
}

/** Calm synthetic authority — premium, not hype-bot. */
export function authorityProsody() {
  return {
    rate: 0.94,
    pitch: "-2Hz",
    volume: 100,
  };
}

/** Slightly slower, warmer delivery — daily fallback. */
export function naturalProsody() {
  return authorityProsody();
}
