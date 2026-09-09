/** Web Audio helpers for Hera mic / TTS energy + lip-sync. */

import type { HeraViseme } from "./types";

export type AudioLevelMonitor = {
  getLevel: () => number;
  stop: () => void;
};

function createAnalyserFromStream(stream: MediaStream): {
  ctx: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array;
} {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  return { ctx, analyser, data };
}

export function rmsFromTimeDomain(analyser: AnalyserNode, data: Uint8Array): number {
  analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>);
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const normalized = ((data[i] ?? 128) - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / Math.max(1, data.length));
}

export function levelFromAnalyser(analyser: AnalyserNode, data: Uint8Array): number {
  analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
  let sum = 0;
  const n = Math.min(data.length, 48);
  for (let i = 0; i < n; i += 1) sum += data[i] ?? 0;
  const avg = sum / (n * 255);
  return Math.max(0, Math.min(1, avg * 1.65));
}

/** Energy from an existing mic stream. Does not stop the tracks. */
export function monitorStreamLevel(stream: MediaStream): AudioLevelMonitor {
  const { ctx, analyser, data } = createAnalyserFromStream(stream);
  if (ctx.state === "suspended") void ctx.resume();
  return {
    getLevel: () => levelFromAnalyser(analyser, data),
    stop: () => {
      void ctx.close();
    },
  };
}

/** Live microphone energy (0–1). Caller must stop() to release the mic. */
export async function startMicLevelMonitor(): Promise<AudioLevelMonitor> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
  const { ctx, analyser, data } = createAnalyserFromStream(stream);
  if (ctx.state === "suspended") await ctx.resume();

  return {
    getLevel: () => levelFromAnalyser(analyser, data),
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
      void ctx.close();
    },
  };
}

/** Analyse a TTS audio URL while it plays; returns monitor + HTMLAudioElement. */
export async function playUrlWithLevelMonitor(
  url: string,
  onEnded?: () => void,
): Promise<{ monitor: AudioLevelMonitor; audio: HTMLAudioElement }> {
  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.65;
  source.connect(analyser);
  analyser.connect(ctx.destination);
  const data = new Uint8Array(analyser.frequencyBinCount);

  const monitor: AudioLevelMonitor = {
    getLevel: () => levelFromAnalyser(analyser, data),
    stop: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      void ctx.close();
    },
  };

  audio.onended = () => {
    onEnded?.();
    monitor.stop();
  };

  if (ctx.state === "suspended") await ctx.resume();
  await audio.play();

  return { monitor, audio };
}

/**
 * Do not use this for Hera's mouth. Volume-based visemes look like a talking puppet.
 * Lip-sync must use phoneme/viseme timelines locked to the audio clock.
 */
export function visemeFromAudioLevel(level: number, t = performance.now()): HeraViseme {
  if (level < 0.08) return "sil";
  if (level < 0.18) return "PP";
  if (level < 0.32) return Math.sin(t / 90) > 0 ? "E" : "I";
  if (level < 0.5) return Math.sin(t / 70) > 0 ? "O" : "aa";
  if (level < 0.7) return "aa";
  return Math.sin(t / 55) > 0 ? "O" : "U";
}

export function visemesForWord(word: string): HeraViseme[] {
  const visemes: HeraViseme[] = [];
  const w = word.toLowerCase().replace(/[^a-z']/g, "");
  for (let i = 0; i < w.length; i += 1) {
    const c = w[i] ?? "";
    const n = w[i + 1] ?? "";
    if ("bmp".includes(c)) visemes.push("PP");
    else if ("fv".includes(c)) visemes.push("FF");
    else if (c === "t" && n === "h") {
      visemes.push("TH");
      i += 1;
    } else if (c === "c" && n === "h") {
      visemes.push("CH");
      i += 1;
    } else if ("tdnl".includes(c)) visemes.push("DD");
    else if ("kgcq".includes(c)) visemes.push("kk");
    else if ("szx".includes(c)) visemes.push("SS");
    else if (c === "r") visemes.push("RR");
    else if (c === "w") visemes.push("U");
    else if (c === "a") visemes.push(n === "i" || n === "y" ? "I" : "aa");
    else if (c === "e") visemes.push("E");
    else if (c === "i" || c === "y") visemes.push("I");
    else if (c === "o") visemes.push(n === "o" || n === "u" ? "U" : "O");
    else if (c === "u") visemes.push("U");
  }
  return visemes.length ? visemes : ["aa"];
}

/** Schedule approximate visemes from spoken text (browser TTS has no phoneme stream). */
export function scheduleVisemesFromText(
  text: string,
  durationMs: number,
  onViseme: (viseme: HeraViseme) => void,
): () => void {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || durationMs <= 0) {
    onViseme("sil");
    return () => undefined;
  }

  const timers: number[] = [];
  const all = words.flatMap((word) => visemesForWord(word));
  const per = durationMs / Math.max(1, all.length);

  all.forEach((viseme, i) => {
    timers.push(
      window.setTimeout(() => {
        onViseme(viseme);
      }, Math.floor(i * per)),
    );
  });

  timers.push(window.setTimeout(() => onViseme("sil"), durationMs));

  return () => {
    for (const id of timers) window.clearTimeout(id);
  };
}

/** Play visemes for one spoken word (used with speechSynthesis onboundary). */
export function scheduleVisemesForWord(
  word: string,
  durationMs: number,
  onViseme: (viseme: HeraViseme) => void,
): () => void {
  const visemes = visemesForWord(word);
  if (!visemes.length) {
    onViseme("sil");
    return () => undefined;
  }
  const per = Math.max(38, durationMs / visemes.length);
  const timers: number[] = [];
  visemes.forEach((viseme, i) => {
    timers.push(window.setTimeout(() => onViseme(viseme), Math.floor(i * per)));
  });
  timers.push(window.setTimeout(() => onViseme("sil"), Math.floor(visemes.length * per)));
  return () => {
    for (const id of timers) window.clearTimeout(id);
  };
}
