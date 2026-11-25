import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HeraHologramPortrait } from "../components/hera/HeraHologramPortrait";
import { heraFaceController } from "../lib/hera/HeraFaceController";
import type { HeraAvatarState } from "../lib/hera/types";

type PreviewHooks = {
  __hera?: typeof heraFaceController;
  __heraSetState?: (state: HeraAvatarState) => void;
};

/**
 * Local-only view of the current Hera portrait. No voice, no conversation.
 * No on-screen labels. State can be driven from the console for QA.
 */
export function HeraFacePreview() {
  const [state, setState] = useState<HeraAvatarState>("idle");
  const [level, setLevel] = useState(0);

  useEffect(() => {
    document.documentElement.classList.add("hera-mode");
    const w = window as unknown as PreviewHooks;
    w.__hera = heraFaceController;
    w.__heraSetState = setState;
    return () => {
      document.documentElement.classList.remove("hera-mode");
      heraFaceController.holdBlink(null);
      delete w.__hera;
      delete w.__heraSetState;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const wave = (Math.sin(now / 140) + 1) / 2;
      const burst = (Math.sin(now / 420) + 1) / 2;
      setLevel(state === "speaking" ? 0.15 + wave * 0.55 * (0.35 + burst * 0.65) : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  return createPortal(
    <div className="hera-screen">
      <div className="hera-screen__stage">
        <HeraHologramPortrait
          state={state}
          isActive
          emotion="neutral"
          audioLevel={level}
          viseme={state === "speaking" ? "aa" : "sil"}
        />
      </div>
    </div>,
    document.body,
  );
}
