import type { HeraAvatarRendererProps } from "../../lib/hera/types";
import { detectHeraLowPerf, prefersReducedMotion } from "../../lib/hera/hologramPerf";
import { HeraHologramPortrait } from "./HeraHologramPortrait";

/**
 * Live Hera face — the approved portrait PNG only. Do not swap in a mesh,
 * canvas redraw, or GLB.
 */
export function HeraHologram(props: HeraAvatarRendererProps) {
  const reducedMotion = props.reducedMotion ?? prefersReducedMotion();
  const lowPerf = props.lowPerf ?? detectHeraLowPerf();

  return <HeraHologramPortrait {...props} reducedMotion={reducedMotion} lowPerf={lowPerf} />;
}

export default HeraHologram;
