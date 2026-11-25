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
  private cooldownUntil = 0;
  private blinkStart = 0;
  private blinkActive = false;
  private scheduleMode = "";
  private phraseOpen = false;
  private pauseSince = 0;
  private t0 = performance.now();
  /** Local preview only. null returns control to the normal blink schedule. */
  private blinkHold: number | null = null;

  /** One blink. Uses the same close/open curve and cooldown as a scheduled blink. */
  requestBlink(): void {
    if (this.reducedMotion || this.blinkActive || this.blinkHold != null) return;
    this.startBlink(performance.now());
  }

  /** Local preview hold. Pass null to release. */
  holdBlink(amount: number | null): void {
    this.blinkHold = amount == null ? null : Math.max(0, Math.min(1, amount));
    if (amount == null) return;
    this.blinkActive = false;
  }

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
    const lip = this.visualMode() === "speaking" ? 0.38 : 0.14;
    const idle = 0.18;
    for (const name of HERA_BLENDSHAPE_NAMES) {
      const isLip = name.startsWith("jaw") || name.startsWith("mouth");
      const isBlink = name.startsWith("eyeBlink");
      const tgt = this.target[name];
      if (isBlink) {
        this.current[name] = tgt;
        continue;
      }
      const cur = this.current[name];
      const k = isLip ? lip : idle;
      this.current[name] = cur + (tgt - cur) * k;
      if (this.current[name] < 0.001) this.current[name] = 0;
    }
  }

  /** Close 90ms, open 140ms. Both eyes share one curve. Returns to 0. */
  private blinkPose(now: number): number {
    if (!this.blinkActive) return 0;
    const closeMs = 90;
    const openMs = 140;
    const elapsed = now - this.blinkStart;
    if (elapsed < closeMs) {
      const t = elapsed / closeMs;
      return t * t;
    }
    if (elapsed < closeMs + openMs) {
      const t = (elapsed - closeMs) / openMs;
      return 1 - t * (2 - t);
    }
    this.blinkActive = false;
    return 0;
  }

  private armSchedule(now: number): void {
    const mode = this.visualMode();
    if (this.scheduleMode === mode) return;
    this.scheduleMode = mode;
    // Infrequent. Eyes stay open most of the time; blinks are occasional reactions.
    const wait =
      mode === "speaking"
        ? 28000 + Math.random() * 18000
        : mode === "listening"
          ? 24000 + Math.random() * 16000
          : 40000 + Math.random() * 25000;
    this.nextBlinkAt = Math.max(now + wait, this.cooldownUntil);
  }

  private startBlink(now: number): void {
    const mode = this.visualMode();
    this.blinkActive = true;
    this.blinkStart = now;
    this.phraseOpen = false;
    this.pauseSince = 0;
    const cooldown =
      mode === "speaking"
        ? 20000 + Math.random() * 12000
        : mode === "listening"
          ? 22000 + Math.random() * 14000
          : 38000 + Math.random() * 22000;
    this.cooldownUntil = now + cooldown;
    this.nextBlinkAt = this.cooldownUntil + (mode === "speaking" ? 8000 + Math.random() * 10000 : 0);
  }

  private updateBlink(now: number): number {
    if (this.blinkHold != null) return this.blinkHold;
    this.armSchedule(now);
    if (this.reducedMotion || this.blinkActive || now < this.cooldownUntil) return this.blinkPose(now);

    const mode = this.visualMode();
    let start = false;
    if (mode === "speaking") {
      // Only after a real phrase pause — not every breath or word — and only sometimes.
      if (this.mouthOpen > 0.28) {
        this.phraseOpen = true;
        this.pauseSince = 0;
      } else if (this.phraseOpen && this.mouthOpen < 0.08) {
        if (this.pauseSince === 0) this.pauseSince = now;
        if (now - this.pauseSince > 520 && Math.random() < 0.28) start = true;
        if (now - this.pauseSince > 520) this.phraseOpen = false;
      } else {
        this.pauseSince = 0;
      }
      if (!start && now >= this.nextBlinkAt) start = true;
    } else if (now >= this.nextBlinkAt) {
      start = true;
    }

    if (start) this.startBlink(now);
    return this.blinkPose(now);
  }

  private composeTargets(t: number, now: number): void {
    for (const name of HERA_BLENDSHAPE_NAMES) this.target[name] = 0;

    if (this.reducedMotion) {
      this.merge(this.visemeWeights, 1);
      return;
    }

    const visual = this.visualMode();
    const blink = this.updateBlink(now);

    const breathe = 0.018 + Math.sin(t * 1.25) * 0.012;
    this.target.jawOpen += visual === "speaking" ? 0 : breathe * 0.35;
    this.target.browInnerUp += visual === "speaking" ? 0.06 : 0;

    this.target.eyeBlinkLeft = blink;
    this.target.eyeBlinkRight = blink;

    if (visual === "thinking") {
      this.target.browInnerUp += 0.08;
    }
    if (visual === "listening") {
      this.target.browInnerUp += 0.12;
    }

    this.merge(this.visemeWeights, visual === "speaking" ? 0.22 : 0.12);
    if (visual === "speaking") this.target.jawOpen = this.mouthOpen;
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
