import { useEffect, useRef } from "react";
import type { HeraAvatarRendererProps, HeraViseme } from "../../lib/hera/types";
import { detectHeraLowPerf, prefersReducedMotion } from "../../lib/hera/hologramPerf";
import { heraFaceController } from "../../lib/hera/HeraFaceController";
import { heraVoice } from "../../lib/hera/HeraVoice";

/** Clean holographic portrait matching the SyNexus Hera design reference. */
export const HERA_FACE_SRC = "/hera/hera-face-alt.png?v=cyan1";

function visemeFromSpeech(open: number, now: number): HeraViseme {
  if (open < 0.06) return "PP";
  const wave = Math.sin(now / 68);
  if (open < 0.18) return wave > 0 ? "I" : "E";
  if (open < 0.34) return wave > 0.25 ? "E" : "O";
  if (open < 0.55) return wave > 0 ? "aa" : "O";
  return wave > 0 ? "aa" : "U";
}

function blinkEase(amount: number): number {
  const x = Math.max(0, Math.min(1, amount));
  return x * x * (3 - 2 * x);
}

function applyFeat(el: HTMLElement | null, transform: string, origin: string) {
  if (!el) return;
  el.style.transformOrigin = origin;
  el.style.transform = transform;
}

/**
 * Image-based holographic Hera. The portrait PNG stays as-is.
 * Only the lash line flicks on a blink — nothing else on the face moves for that.
 */
export function HeraHologramPortrait({
  state = "idle",
  isActive = true,
  audioLevel = 0,
  viseme = null,
  emotion = "neutral",
  className = "",
  reducedMotion: reducedMotionProp,
  lowPerf: lowPerfProp,
}: HeraAvatarRendererProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLImageElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const lashLRef = useRef<HTMLDivElement>(null);
  const lashRRef = useRef<HTMLDivElement>(null);
  const lipLRef = useRef<HTMLImageElement>(null);
  const openingRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = reducedMotionProp ?? prefersReducedMotion();
  const lowPerf = lowPerfProp ?? detectHeraLowPerf();

  const stateRef = useRef(state);
  const emotionRef = useRef(emotion);
  const audioLevelRef = useRef(audioLevel);
  const visemeRef = useRef(viseme);
  stateRef.current = state;
  emotionRef.current = emotion;
  audioLevelRef.current = audioLevel;
  visemeRef.current = viseme;

  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const stack = stackRef.current;
      const scan = scanRef.current;
      const s = stateRef.current;
      const e = emotionRef.current;
      const speaking = s === "speaking";
      const listening = s === "listening" || s === "interrupted";
      const thinking = s === "thinking" || s === "connecting";
      const open = speaking ? Math.max(heraFaceController.mouthOpen, audioLevelRef.current) : 0;

      heraFaceController.setMode(s);
      heraFaceController.setMouthOpen(open);

      const voiceViseme = heraVoice.isSpeaking() ? heraVoice.pumpFace() : null;
      const nextViseme = speaking
        ? visemeRef.current || voiceViseme || visemeFromSpeech(open, now)
        : "sil";
      if (!heraVoice.isSpeaking()) {
        heraFaceController.setViseme(nextViseme, speaking ? Math.max(0.45, open) : 0.2);
      }

      heraFaceController.tick(now);
      const w = heraFaceController.current;
      const glowLevel = speaking ? open : listening ? 0.2 : thinking ? 0.14 : 0.08;

      if (!reducedMotion && stack) {
        const breathe = Math.sin(t * 1.15) * (lowPerf ? 1.2 : 2.2);
        const talkNod = speaking ? Math.sin(t * 2.2) * 0.35 + open * 0.6 : 0;
        const talkTurn = speaking ? Math.sin(t * 0.85) * 0.55 : 0;
        const listenSway = listening ? Math.sin(t * 0.85) * 0.9 : Math.sin(t * 0.55) * 0.55;
        const thinkSway = thinking || e === "thinking" ? Math.sin(t * 1.4) * 1.6 : 0;
        const lean = listening ? 1.1 : speaking ? 0.45 : 0;
        stack.style.transform = `perspective(900px) translate3d(${talkTurn + listenSway + thinkSway}px, ${breathe + talkNod}px, 0) rotateX(${lean}deg) rotateZ(${talkTurn * 0.12}deg)`;
      }

      if (!reducedMotion) {
        const blinkL = blinkEase(w.eyeBlinkLeft);
        const blinkR = blinkEase(w.eyeBlinkRight);
        const jaw = Math.max(0, w.jawOpen - w.mouthClose * 0.35);
        const smile = (w.mouthSmileLeft + w.mouthSmileRight) * 0.5;
        const pucker = Math.max(w.mouthPucker, w.mouthFunnel);

        applyFeat(
          lashLRef.current,
          `translateY(${(blinkL * 2.4).toFixed(2)}px)`,
          "34% 25.5%",
        );
        applyFeat(
          lashRRef.current,
          `translateY(${(blinkR * 2.4).toFixed(2)}px)`,
          "55.3% 25.5%",
        );
        applyFeat(
          lipLRef.current,
          `translateY(${(jaw * 2.8).toFixed(2)}px) scale(${(1 + smile * 0.04 - pucker * 0.06).toFixed(3)}, 1)`,
          "44.7% 51.4%",
        );

        const opening = openingRef.current;
        if (opening) {
          const amt = Math.max(0, jaw);
          opening.style.opacity = String(Math.min(0.92, amt * 1.8));
          opening.style.transform = `translate(-50%, -50%) scale(${(0.7 + smile * 0.18 - pucker * 0.2).toFixed(3)}, ${(0.12 + amt * 0.95).toFixed(3)})`;
        }
      }

      if (scan && !reducedMotion) {
        scan.style.backgroundPosition = `0 ${((t * 36) % 100).toFixed(1)}%`;
        scan.style.opacity = String(0.06 + glowLevel * 0.04);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lowPerf, reducedMotion]);

  const particleCount = reducedMotion ? 0 : lowPerf ? 10 : 22;

  return (
    <div
      ref={wrapRef}
      className={`hera-hologram hera-hologram--portrait hera-hologram--${state}${isActive ? " hera-hologram--active" : " hera-hologram--inactive"} hera-hologram--emotion-${emotion}${className ? ` ${className}` : ""}`}
      data-state={state}
      data-emotion={emotion}
      aria-hidden="true"
    >
      <div className="hera-hologram__circuit" aria-hidden>
        <svg className="hera-hologram__circuit-traces" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M4 16 H26 V8 H48" />
          <path d="M96 14 H74 V6 H52" />
          <path d="M6 86 H22 V72 H8 V54" />
          <path d="M94 88 H78 V70 H92 V52" />
          <path d="M18 4 V22 H8 V38" />
          <path d="M82 4 V24 H92 V40" />
          <path d="M28 96 H44 V84 H62 V96 H78" />
          <circle r="0.55" className="hera-hologram__circuit-spark">
            <animateMotion dur="7.5s" repeatCount="indefinite" path="M4 16 H26 V8 H48" />
          </circle>
          <circle r="0.5" className="hera-hologram__circuit-spark hera-hologram__circuit-spark--late">
            <animateMotion dur="11s" repeatCount="indefinite" path="M96 14 H74 V6 H52" />
          </circle>
          <circle r="0.48" className="hera-hologram__circuit-spark">
            <animateMotion dur="9.2s" repeatCount="indefinite" path="M6 86 H22 V72 H8 V54" />
          </circle>
          <circle r="0.52" className="hera-hologram__circuit-spark hera-hologram__circuit-spark--late">
            <animateMotion dur="12.5s" repeatCount="indefinite" path="M94 88 H78 V70 H92 V52" />
          </circle>
          <circle r="0.45" className="hera-hologram__circuit-spark">
            <animateMotion dur="10s" repeatCount="indefinite" path="M28 96 H44 V84 H62 V96 H78" />
          </circle>
        </svg>
      </div>
      <div ref={stackRef} className="hera-hologram__face-stack">
        <img
          ref={faceRef}
          className="hera-hologram__face"
          src={HERA_FACE_SRC}
          alt=""
          draggable={false}
        />
        {reducedMotion ? null : (
          <>
            <div ref={lashLRef} className="hera-hologram__feat hera-hologram__feat--lash-l">
              <img src={HERA_FACE_SRC} alt="" draggable={false} />
            </div>
            <div ref={lashRRef} className="hera-hologram__feat hera-hologram__feat--lash-r">
              <img src={HERA_FACE_SRC} alt="" draggable={false} />
            </div>
            <div className="hera-hologram__feat hera-hologram__feat--lip-l">
              <img ref={lipLRef} src={HERA_FACE_SRC} alt="" draggable={false} />
            </div>
            <span ref={openingRef} className="hera-hologram__opening" />
          </>
        )}
      </div>
      <div ref={scanRef} className="hera-hologram__scanlines" />
      <div className="hera-hologram__particles" aria-hidden>
        {Array.from({ length: particleCount }, (_, i) => (
          <span key={i} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <div className="hera-hologram__vignette" />
    </div>
  );
}

export default HeraHologramPortrait;
