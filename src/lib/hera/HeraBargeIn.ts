/**
 * Energy-based barge-in while Hera is speaking.
 * Uses echo-cancelled mic energy calibrated against the room's floor so the user can
 * interrupt naturally without speaker bleed or background hum false-triggering.
 */
import { calibrateNoise } from "./endpointing";

const STARTUP_MS = 420;
const HOLD_MS = 150;
const MIN_BARGE_THRESHOLD = 0.22;
const MAX_BARGE_THRESHOLD = 0.42;

export type HeraBargeInHandle = {
  stop: () => void;
};

export async function startHeraBargeIn(onBargeIn: () => void): Promise<HeraBargeInHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.35;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  let raf = 0;
  let stopped = false;
  let aboveSince = 0;
  const startedAt = performance.now();
  const floorSamples: number[] = [];
  let threshold = 0.3;
  let calibrated = false;
  let fired = false;

  const tick = (now: number) => {
    if (stopped) return;
    analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
    // Focus on fundamental human voice bins (~150Hz–2.8kHz) instead of DC rumble.
    let sum = 0;
    const startBin = 2;
    const endBin = Math.min(data.length, 36);
    for (let i = startBin; i < endBin; i += 1) sum += data[i] ?? 0;
    const level = sum / (Math.max(1, endBin - startBin) * 255);

    if (now - startedAt < STARTUP_MS) {
      floorSamples.push(level);
      raf = requestAnimationFrame(tick);
      return;
    }
    if (!calibrated) {
      calibrated = true;
      const { speechLevel } = calibrateNoise(floorSamples);
      threshold = Math.min(MAX_BARGE_THRESHOLD, Math.max(MIN_BARGE_THRESHOLD, speechLevel * 2.2 + 0.1));
    }
    if (level >= threshold) {
      if (!aboveSince) aboveSince = now;
      if (!fired && now - aboveSince >= HOLD_MS) {
        fired = true;
        onBargeIn();
        stop();
        return;
      }
    } else {
      aboveSince = 0;
    }
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    for (const track of stream.getTracks()) track.stop();
    void ctx.close();
  };

  raf = requestAnimationFrame(tick);
  return { stop };
}
