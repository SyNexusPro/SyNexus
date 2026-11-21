/** Measured against the previous lip follower (attack 0.28, release 0.10) and a 1.5s ICE cap. */

export const LIP_ATTACK = 0.55;
export const LIP_RELEASE = 0.32;
export const MOUTH_FOLLOW = 0.42;
export const ICE_EARLY_MS = 600;
export const ICE_CAP_MS = 1800;

export function lipEnvelope(prev: number, raw: number): number {
  const gated = raw < 0.04 ? 0 : Math.min(1, raw);
  const k = gated > prev ? LIP_ATTACK : LIP_RELEASE;
  const next = prev + (gated - prev) * k;
  return next < 0.008 ? 0 : next;
}

/** Milliseconds from the user finishing a turn to the first audio frame. Null if the sample is unusable. */
export function turnLatencyMs(speechStoppedAt: number, firstAudioAt: number): number | null {
  if (!Number.isFinite(speechStoppedAt) || !Number.isFinite(firstAudioAt)) return null;
  const delta = firstAudioAt - speechStoppedAt;
  if (delta < 0 || delta > 60_000) return null;
  return Math.round(delta);
}
