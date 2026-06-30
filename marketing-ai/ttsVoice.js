/** Natural female voice — human delivery, not robotic. */

export const DEFAULT_TTS_VOICE =
  process.env.VIDEO_TTS_VOICE?.trim() || "en-US-JennyNeural";

const FEMALE_VOICES = new Set([
  "en-US-AriaNeural",
  "en-US-JennyNeural",
  "en-US-AvaNeural",
  "en-US-EmmaNeural",
  "en-US-AnaNeural",
  "en-US-MichelleNeural",
  "en-GB-SoniaNeural",
  "en-GB-LibbyNeural",
]);

export function resolveTtsVoice(requested) {
  const v = requested?.trim() || DEFAULT_TTS_VOICE;
  if (FEMALE_VOICES.has(v)) return v;
  if (/Neural/i.test(v) && !/Guy|Ryan|Christopher|Eric|Steffan|Roger/i.test(v)) return v;
  return DEFAULT_TTS_VOICE;
}

/** Hook — slightly faster, still natural. */
export function hookProsody() {
  return {
    rate: 1.04,
    pitch: "+1Hz",
    volume: 100,
  };
}

/** Main narration — conversational human pace. */
export function naturalProsody() {
  return {
    rate: 0.98,
    pitch: "+0Hz",
    volume: 100,
  };
}

/** @deprecated alias */
export function badassProsody() {
  return naturalProsody();
}

/** Close / CTA — warm landing. */
export function closeProsody() {
  return {
    rate: 0.96,
    pitch: "-1Hz",
    volume: 98,
  };
}

export function prosodyForSegment(index, total) {
  if (index === 0) return hookProsody();
  if (index === total - 1) return closeProsody();
  return naturalProsody();
}
