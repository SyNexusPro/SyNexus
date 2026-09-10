/** Perf helpers for Hera hologram — keep mobile / low-end devices light. */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function detectHeraLowPerf(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const saveData = Boolean(nav.connection?.saveData);
  const slowNet = /2g|slow-2g/i.test(nav.connection?.effectiveType ?? "");
  const narrow = window.matchMedia("(max-width: 720px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return saveData || slowNet || memory <= 2 || cores <= 2 || (narrow && coarse);
}

export function hologramParticleBudget(lowPerf: boolean, reducedMotion: boolean): number {
  if (reducedMotion) return 8;
  if (lowPerf) return 18;
  return 42;
}
