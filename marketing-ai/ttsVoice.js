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

/** Slightly slower, warmer delivery — less robotic. */
export function naturalProsody() {
  return {
    rate: 0.91,
    pitch: "+6Hz",
    volume: 100,
  };
}
