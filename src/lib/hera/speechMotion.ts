export type SpeechPose = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rz: number;
};

/** A syllable onset adds a small nod, then it settles. */
export function nextSpeechNod(prev: number, open: number, previousOpen: number): number {
  const rise = Math.max(0, open - previousOpen);
  const nod = prev * 0.86 + Math.min(0.7, rise * 2.2);
  return nod < 0.01 ? 0 : nod;
}

/**
 * Head motion while the same portrait is speaking.
 * Degrees stay under about 1.3. Pixels stay under about 4.
 */
export function speechPose(t: number, open: number, nod: number): SpeechPose {
  const level = Math.max(0, Math.min(1, open));
  const pulse = Math.max(0, Math.min(1, nod));
  return {
    x: Math.sin(t * 0.48) * 1.4,
    y: Math.sin(t * 0.7) * 0.9 + pulse * 2.4,
    rx: 0.16 + level * 0.62 + pulse * 0.48,
    ry: Math.sin(t * 0.22) * 0.42,
    rz: Math.sin(t * 0.17) * 0.32,
  };
}
