import { heraFaceController } from "./HeraFaceController";
import { HeraLipSync } from "./HeraLipSync";
import { textForTitanSpeech } from "../titanVoice";
import type { HeraViseme } from "./types";

export type HeraVoiceEvents = {
  onSpeaking?: (speaking: boolean) => void;
  onViseme?: (viseme: HeraViseme) => void;
  onError?: (message: string) => void;
};

type Listener = HeraVoiceEvents;

type StreamEvent =
  | { type: "audio"; pcm?: string; mp3?: string; sampleRate?: number }
  | { type: "alignment"; chars: string[]; charStartTimesMs: number[]; charDurationsMs?: number[] }
  | { type: "done"; text?: string; durationMs?: number }
  | { type: "error"; error?: string };

function getAudioContextCtor(): typeof AudioContext {
  return window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
}

function decodeBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function pcm16ToBuffer(ctx: AudioContext, pcm: ArrayBuffer, sampleRate: number): AudioBuffer {
  const int16 = new Int16Array(pcm);
  const buf = ctx.createBuffer(1, int16.length, sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < int16.length; i += 1) ch[i] = (int16[i] ?? 0) / 32768;
  return buf;
}

/**
 * Streaming Hera voice. Audio and visemes share one AudioContext clock.
 * Mouth shapes come from alignment/visemes — never from playback RMS.
 */
export class HeraVoice {
  readonly lipSync: HeraLipSync;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];
  private speaking = false;
  private queue: string[] = [];
  private busy = false;
  private generation = 0;
  private lastViseme: HeraViseme = "sil";
  private listeners = new Set<Listener>();
  private faceRaf = 0;

  constructor(lipSync = new HeraLipSync(heraFaceController)) {
    this.lipSync = lipSync;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  get viseme(): HeraViseme {
    return this.lastViseme;
  }

  /** Call from the avatar animation frame — visemes stay locked to the audio clock. */
  pumpFace(): HeraViseme {
    const viseme = this.lipSync.sync(this.currentTime);
    this.emitViseme(viseme);
    return viseme;
  }

  private startFacePump(): void {
    if (this.faceRaf) return;
    const tick = () => {
      this.pumpFace();
      if (this.speaking || this.sources.length) {
        this.faceRaf = requestAnimationFrame(tick);
        return;
      }
      this.faceRaf = 0;
    };
    this.faceRaf = requestAnimationFrame(tick);
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
  }

  stop(): void {
    this.generation += 1;
    this.queue = [];
    this.busy = false;
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
    }
    this.nextTime = this.ctx?.currentTime ?? 0;
    this.lipSync.clear();
    this.setSpeaking(false);
    this.emitViseme("sil");
  }

  /** Queue spoken text; starts playback as soon as the first audio chunk is scheduled. */
  async speak(text: string): Promise<void> {
    const spoken = textForTitanSpeech(text).trim();
    if (!spoken) return;
    if (this.busy) {
      this.queue.push(spoken);
      return;
    }
    await this.unlock();
    this.busy = true;
    const gen = this.generation;
    try {
      await this.streamUtterance(spoken, gen);
    } catch (err) {
      if (gen === this.generation) {
        for (const listener of this.listeners) {
          listener.onError?.(err instanceof Error ? err.message : "Speech failed");
        }
        try {
          await this.playFallbackMp3(spoken, gen);
        } catch {
          /* browser TTS is handled by the caller if this also fails */
        }
      }
    } finally {
      if (gen !== this.generation) return;
      this.busy = false;
      const next = this.queue.shift();
      if (next) {
        void this.speak(next);
        return;
      }
      this.waitUntilQuiet(gen);
    }
  }

  enqueue(text: string): void {
    void this.speak(text);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (getAudioContextCtor())();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.nextTime = this.ctx.currentTime;
    }
    return this.ctx;
  }

  private setSpeaking(on: boolean): void {
    if (this.speaking === on) return;
    this.speaking = on;
    heraFaceController.setMode(on ? "speaking" : heraFaceController.mode === "speaking" ? "idle" : heraFaceController.mode);
    for (const listener of this.listeners) listener.onSpeaking?.(on);
    if (on) this.startFacePump();
  }

  private emitViseme(viseme: HeraViseme): void {
    if (viseme === this.lastViseme) return;
    this.lastViseme = viseme;
    for (const listener of this.listeners) listener.onViseme?.(viseme);
  }

  private scheduleBuffer(buf: AudioBuffer, gen: number): number {
    const ctx = this.ensureContext();
    const gain = this.gain!;
    const start = Math.max(ctx.currentTime + 0.03, this.nextTime);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(1, start);
    src.start(start);
    this.sources.push(src);
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src);
    };
    this.nextTime = start + buf.duration;
    if (gen === this.generation) this.setSpeaking(true);
    return start;
  }

  private async streamUtterance(text: string, gen: number): Promise<void> {
    const res = await fetch("/api/hera/voice-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({ text }),
    });
    if (res.status === 501 || !res.ok || !res.body) {
      throw new Error("Streaming voice unavailable");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let carry = "";
    let clipStart: number | null = null;
    const mp3Chunks: ArrayBuffer[] = [];

    const handle = (ev: StreamEvent) => {
      if (gen !== this.generation) return;
      if (ev.type === "audio") {
        const ctx = this.ensureContext();
        if (ev.pcm) {
          const buf = pcm16ToBuffer(ctx, decodeBase64(ev.pcm), ev.sampleRate ?? 24000);
          const start = this.scheduleBuffer(buf, gen);
          if (clipStart == null) clipStart = start;
        } else if (ev.mp3) {
          mp3Chunks.push(decodeBase64(ev.mp3));
        }
      } else if (ev.type === "alignment") {
        const start = clipStart ?? Math.max(this.ensureContext().currentTime + 0.03, this.nextTime);
        this.lipSync.addAlignment({
          clockStart: start,
          chars: ev.chars,
          charStartTimesMs: ev.charStartTimesMs,
          charDurationsMs: ev.charDurationsMs,
        });
      } else if (ev.type === "done" && !clipStart && ev.durationMs && ev.text) {
        const start = Math.max(this.ensureContext().currentTime + 0.03, this.nextTime);
        this.lipSync.addTextOnClock({ clockStart: start, duration: ev.durationMs / 1000, text: ev.text });
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (gen !== this.generation) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return;
      }
      carry += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = carry.split("\n");
      carry = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          handle(JSON.parse(trimmed) as StreamEvent);
        } catch {
          /* skip incomplete JSON */
        }
      }
      if (done) break;
    }

    if (gen !== this.generation) return;
    if (mp3Chunks.length) {
      await this.playMp3Buffers(mp3Chunks, text, gen, clipStart);
    }
  }

  private async playMp3Buffers(
    chunks: ArrayBuffer[],
    text: string,
    gen: number,
    existingStart: number | null,
  ): Promise<void> {
    const ctx = this.ensureContext();
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      joined.set(new Uint8Array(c), offset);
      offset += c.byteLength;
    }
    const buf = await ctx.decodeAudioData(joined.buffer.slice(0));
    if (gen !== this.generation) return;
    const start = this.scheduleBuffer(buf, gen);
    if (existingStart == null) {
      this.lipSync.addTextOnClock({ clockStart: start, duration: buf.duration, text });
    }
  }

  private async playFallbackMp3(text: string, gen: number): Promise<void> {
    const res = await fetch("/api/hera/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("TTS unavailable");
    const buf = await res.arrayBuffer();
    const audio = await this.ensureContext().decodeAudioData(buf.slice(0));
    if (gen !== this.generation) return;
    const start = this.scheduleBuffer(audio, gen);
    this.lipSync.addTextOnClock({ clockStart: start, duration: audio.duration, text });
  }

  private waitUntilQuiet(gen: number): void {
    const tick = () => {
      if (gen !== this.generation) return;
      const ctx = this.ctx;
      if (!ctx || this.nextTime > ctx.currentTime + 0.05 || this.sources.length) {
        window.setTimeout(tick, 40);
        return;
      }
      this.lipSync.clear();
      this.setSpeaking(false);
      this.emitViseme("sil");
    };
    window.setTimeout(tick, 40);
  }
}

export const heraVoice = new HeraVoice();
