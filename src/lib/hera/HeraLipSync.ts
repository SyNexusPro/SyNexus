import { charToViseme } from "./blendshapes";
import type { HeraFaceController } from "./HeraFaceController";
import type { HeraViseme } from "./types";
import { visemesForWord } from "./audioAnalysis";

export type LipSyncCue = {
  /** Seconds on the shared AudioContext clock. */
  at: number;
  viseme: HeraViseme;
};

/**
 * Viseme timeline locked to the Web Audio clock so lips never drift from speech.
 * Does not use microphone or playback RMS for mouth shape.
 */
export class HeraLipSync {
  private cues: LipSyncCue[] = [];
  private index = 0;
  private lastViseme: HeraViseme = "sil";

  constructor(private readonly face: HeraFaceController) {}

  clear(): void {
    this.cues = [];
    this.index = 0;
    this.lastViseme = "sil";
    this.face.setViseme("sil");
  }

  /** Character alignment from ElevenLabs (times are relative to clip start on the audio clock). */
  addAlignment(opts: {
    clockStart: number;
    chars: string[];
    charStartTimesMs: number[];
    charDurationsMs?: number[];
  }): void {
    const { clockStart, chars, charStartTimesMs } = opts;
    for (let i = 0; i < chars.length; i += 1) {
      const viseme = charToViseme(chars[i] ?? "");
      this.cues.push({ at: clockStart + (charStartTimesMs[i] ?? 0) / 1000, viseme });
    }
    this.cues.sort((a, b) => a.at - b.at);
  }

  /** Fallback when a provider has no phoneme stream: map words onto a timed clip. */
  addTextOnClock(opts: { clockStart: number; duration: number; text: string }): void {
    const words = opts.text.trim().split(/\s+/).filter(Boolean);
    const visemes = words.flatMap((word) => visemesForWord(word));
    if (!visemes.length || opts.duration <= 0) return;
    const step = opts.duration / visemes.length;
    visemes.forEach((viseme, i) => {
      this.cues.push({ at: opts.clockStart + i * step, viseme });
    });
    this.cues.push({ at: opts.clockStart + opts.duration, viseme: "sil" });
    this.cues.sort((a, b) => a.at - b.at);
  }

  /** Drive the face from AudioContext.currentTime. */
  sync(audioTime: number): HeraViseme {
    while (this.index < this.cues.length && this.cues[this.index]!.at <= audioTime) {
      this.lastViseme = this.cues[this.index]!.viseme;
      this.index += 1;
    }
    this.face.setViseme(this.lastViseme);
    return this.lastViseme;
  }

  get viseme(): HeraViseme {
    return this.lastViseme;
  }
}
