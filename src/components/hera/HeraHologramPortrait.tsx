import { useEffect, useRef } from "react";
import type { HeraAvatarRendererProps } from "../../lib/hera/types";
import { detectHeraLowPerf, prefersReducedMotion } from "../../lib/hera/hologramPerf";
import { heraFaceController } from "../../lib/hera/HeraFaceController";
import { heraVoice } from "../../lib/hera/HeraVoice";
import { lipEnvelope } from "../../lib/hera/turnTiming";

/** New holographic Hera (head-and-shoulders, not the old green android bust). */
export const HERA_FACE_SRC = "/hera/hera-face.jpg?v=holo-v2";

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
  const lipLRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef<HTMLSpanElement>(null);
  const lipEnvRef = useRef(0);
  const poseRef = useRef({ x: 0, y: 0, rx: 0, ry: 0, rz: 0 });
  const reducedMotion = reducedMotionProp ?? prefersReducedMotion();
  const lowPerf = lowPerfProp ?? detectHeraLowPerf();

  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);
  const visemeRef = useRef(viseme);
  stateRef.current = state;
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
      const speaking = s === "speaking";
      const listening = s === "listening" || s === "interrupted";
      const thinking = s === "thinking" || s === "connecting";
      const rawOpen = speaking
        ? Math.max(heraFaceController.mouthOpen, audioLevelRef.current)
        : 0;
      const open = (lipEnvRef.current = lipEnvelope(lipEnvRef.current, rawOpen));

      heraFaceController.setMode(s);
      heraFaceController.setMouthOpen(open);

      if (heraVoice.isSpeaking()) {
        heraVoice.pumpFace();
      } else {
        heraFaceController.setViseme(speaking ? visemeRef.current : "sil", speaking ? 0.35 : 0.12);
      }

      heraFaceController.tick(now);
      const w = heraFaceController.current;
      const glowLevel = speaking ? open : listening ? 0.2 : thinking ? 0.14 : 0.08;

      if (!reducedMotion && stack) {
        const breathe = Math.sin(t * 0.72) * (lowPerf ? 0.45 : 0.85);
        const talkNod = speaking ? open * 0.28 : 0;
        const listenSettle = listening ? Math.sin(t * 0.4) * 0.18 : Math.sin(t * 0.28) * 0.1;
        const lean = listening ? 0.22 : speaking ? 0.08 : thinking ? 0.06 : 0;
        const attention = speaking ? 0.4 : listening ? 0.16 : 0;
        const pose = poseRef.current;
        const tx = listenSettle;
        const ty = breathe + talkNod;
        pose.x += (tx - pose.x) * 0.06;
        pose.y += (ty - pose.y) * 0.06;
        pose.rx += (lean - pose.rx) * 0.05;
        pose.ry += (attention - pose.ry) * 0.05;
        pose.rz += (0 - pose.rz) * 0.08;
        stack.style.transform = `perspective(900px) translate3d(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px, 0) rotateX(${pose.rx.toFixed(2)}deg) rotateY(${pose.ry.toFixed(2)}deg) rotateZ(${pose.rz.toFixed(2)}deg)`;
      }

      if (!reducedMotion) {
        const blinkL = blinkEase(w.eyeBlinkLeft);
        const blinkR = blinkEase(w.eyeBlinkRight);
        const jaw = open;

        applyFeat(
          lashLRef.current,
          `translateY(${(blinkL * 3.1).toFixed(2)}px)`,
          "38% 42.8%",
        );
        applyFeat(
          lashRRef.current,
          `translateY(${(blinkR * 3.1).toFixed(2)}px)`,
          "62% 42.8%",
        );
        applyFeat(
          lipLRef.current,
          `translateY(${(jaw * 4.2).toFixed(2)}px)`,
          "50% 60.8%",
        );

        const opening = openingRef.current;
        if (opening) {
          opening.style.opacity = String(Math.min(0.88, jaw * 1.55));
          opening.style.transform = `translate(-50%, -50%) scale(1, ${(0.12 + jaw * 0.9).toFixed(3)})`;
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
            <div ref={lipLRef} className="hera-hologram__feat hera-hologram__feat--lip-l">
              <img src={HERA_FACE_SRC} alt="" draggable={false} />
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
