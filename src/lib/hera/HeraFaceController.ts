import type { HeraAvatarState, HeraViseme } from "./types";
import {
  emptyBlendshapes,
  HERA_BLENDSHAPE_NAMES,
  visemeBlendshapes,
  type HeraBlendshapeName,
  type HeraBlendshapeWeights,
} from "./blendshapes";

export type HeraFaceMode = HeraAvatarState;

/**
 * Owns blendshape weights. Animation loop writes morphTargetInfluences via refs —
 * React is not re-rendered per frame.
 */
export class HeraFaceController {
  readonly current: HeraBlendshapeWeights = emptyBlendshapes();
  readonly target: HeraBlendshapeWeights = emptyBlendshapes();
  mode: HeraFaceMode = "idle";
  reducedMotion = false;
  /** 0–1, driven by outgoing speech amplitude. */
  mouthOpen = 0;

  private visemeWeights: Partial<HeraBlendshapeWeights> = {};
  private nextBlinkAt = 0;
  private blinkUntil = 0;
  private nextSaccadeAt = 0;
  private saccade: { x: number; y: number } = { x: 0, y: 0 };
  private t0 = performance.now();

  setMode(mode: HeraFaceMode): void {
    this.mode = mode;
  }

  setMouthOpen(amount: number): void {
    this.mouthOpen = Math.max(0, Math.min(1, amount));
  }

  private visualMode(): "idle" | "listening" | "thinking" | "speaking" {
    if (this.mode === "speaking") return "speaking";
    if (this.mode === "thinking" || this.mode === "connecting") return "thinking";
    if (this.mode === "listening" || this.mode === "interrupted") return "listening";
    return "idle";
  }

  /** Viseme mouth shapes only — never audio RMS. */
  setViseme(viseme: HeraViseme | null, amount = 1): void {
    const mapped = visemeBlendshapes(viseme);
    const next: Partial<HeraBlendshapeWeights> = {};
    for (const [key, value] of Object.entries(mapped)) {
      next[key as HeraBlendshapeName] = (value ?? 0) * amount;
    }
    this.visemeWeights = next;
  }

  applyToInfluences(influences: number[] | Float32Array): void {
    const n = Math.min(influences.length, HERA_BLENDSHAPE_NAMES.length);
    for (let i = 0; i < n; i += 1) {
      const name = HERA_BLENDSHAPE_NAMES[i];
      if (name) influences[i] = this.current[name];
    }
  }

  tick(now = performance.now()): void {
    const t = (now - this.t0) / 1000;
    this.composeTargets(t, now);
    const lip = this.visualMode() === "speaking" ? 0.58 : 0.16;
    const idle = 0.18;
    for (const name of HERA_BLENDSHAPE_NAMES) {
      const isLip = name.startsWith("jaw") || name.startsWith("mouth");
      const isBlink = name.startsWith("eyeBlink");
      const cur = this.current[name];
      const tgt = this.target[name];
      const k = isBlink ? (tgt > cur ? 0.5 : 0.18) : isLip ? lip : idle;
      this.current[name] = cur + (tgt - cur) * k;
      if (this.current[name] < 0.001) this.current[name] = 0;
    }
  }

  private composeTargets(t: number, now: number): void {
    for (const name of HERA_BLENDSHAPE_NAMES) this.target[name] = 0;

    if (this.reducedMotion) {
      this.merge(this.visemeWeights, 1);
      return;
    }

    if (now > this.nextBlinkAt) {
      this.blinkUntil = now + 42 + Math.random() * 28;
      const double = Math.random() < 0.16;
      const longGap = !double && Math.random() < 0.12;
      this.nextBlinkAt = double
        ? now + 150 + Math.random() * 70
        : now + (longGap ? 6500 + Math.random() * 2500 : 2600 + Math.random() * 3400);
    }
    const blinking = now < this.blinkUntil ? 1 : 0;
    const blinkRight = now < this.blinkUntil - 14 ? 1 : 0;

    const visual = this.visualMode();

    if (now > this.nextSaccadeAt) {
      const attentive = visual === "listening";
      const thinking = visual === "thinking";
      const speaking = visual === "speaking";
      this.nextSaccadeAt = now + (speaking ? 600 + Math.random() * 900 : attentive || thinking ? 1400 + Math.random() * 2200 : 800 + Math.random() * 1600);
      this.saccade = {
        x: speaking
          ? (Math.random() - 0.5) * 0.1
          : attentive
            ? (Math.random() - 0.5) * 0.12
            : thinking
              ? -0.22 - Math.random() * 0.2
              : (Math.random() - 0.5) * 0.28,
        y: speaking ? (Math.random() - 0.5) * 0.08 : attentive ? (Math.random() - 0.5) * 0.08 : thinking ? -0.18 : (Math.random() - 0.5) * 0.2,
      };
    }

    const breathe = 0.018 + Math.sin(t * 1.25) * 0.012;
    this.target.jawOpen += visual === "speaking" ? this.mouthOpen * 0.92 : breathe * 0.35;
    this.target.browInnerUp += visual === "speaking" ? 0.06 : 0;

    this.target.eyeBlinkLeft = blinking;
    this.target.eyeBlinkRight = blinkRight;

    const lookX = this.saccade.x;
    const lookY = this.saccade.y;
    if (lookX >= 0) this.target.eyeLookRight = lookX;
    else this.target.eyeLookLeft = -lookX;
    if (lookY >= 0) this.target.eyeLookUp = lookY;
    else this.target.eyeLookDown = -lookY;

    if (visual === "thinking") {
      this.target.browDownLeft = 0.18;
      this.target.browDownRight = 0.12;
      this.target.eyeLookDown = Math.max(this.target.eyeLookDown, 0.16);
    }
    if (visual === "listening") {
      this.target.browInnerUp += 0.12;
      this.target.eyeLookDown *= 0.25;
      this.target.eyeLookLeft *= 0.35;
      this.target.eyeLookRight *= 0.35;
    }

    this.merge(this.visemeWeights, visual === "speaking" ? 1 : 0.15);
    this.clamp();
  }

  private merge(partial: Partial<HeraBlendshapeWeights>, amount: number): void {
    for (const [key, value] of Object.entries(partial)) {
      const name = key as HeraBlendshapeName;
      this.target[name] = Math.max(this.target[name], (value ?? 0) * amount);
    }
  }

  private clamp(): void {
    for (const name of HERA_BLENDSHAPE_NAMES) {
      this.target[name] = Math.max(0, Math.min(1, this.target[name]));
    }
  }
}

export const heraFaceController = new HeraFaceController();
