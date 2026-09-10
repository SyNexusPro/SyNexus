/**
 * Energy-based barge-in while Hera is speaking.
 * Uses echo-cancelled mic RMS — not SpeechRecognition — so her TTS is not transcribed.
 */

const STARTUP_MS = 480;
const HOLD_MS = 140;
const THRESHOLD = 0.4;

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
  let fired = false;

  const tick = (now: number) => {
    if (stopped) return;
    analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
    let sum = 0;
    const n = Math.min(data.length, 40);
    for (let i = 0; i < n; i += 1) sum += data[i] ?? 0;
    const level = sum / (n * 255);

    if (now - startedAt < STARTUP_MS) {
      raf = requestAnimationFrame(tick);
      return;
    }
    if (level >= THRESHOLD) {
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
