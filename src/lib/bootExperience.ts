import { Capacitor } from "@capacitor/core";

const BOOT_SEEN_KEY = "synexus_boot_intro_seen";

export type BootProfile = "skip" | "fast" | "full";

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function isNativeMobile(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios";
}

export function hasSeenBootIntro(): boolean {
  try {
    return localStorage.getItem(BOOT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBootIntroSeen(): void {
  try {
    localStorage.setItem(BOOT_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** skip = return visit on native · fast = first native launch · full = desktop web */
export function resolveBootProfile(reducedMotion = readPrefersReducedMotion()): BootProfile {
  if (isNativeMobile() && hasSeenBootIntro()) return "skip";
  if (reducedMotion || isNativeMobile()) return "fast";
  return "full";
}

/**
 * Phase gaps (ms): transitions 0→1 … 3→4, hold finale, exit fade.
 * fast ≈ 1.35s · full ≈ 6.4s · reduced web uses fast timings.
 */
export function getBootDurations(profile: BootProfile): readonly number[] {
  if (profile === "skip") return [0, 0, 0, 0, 0, 0];
  if (profile === "fast") {
    return [120, 180, 280, 180, 260, 180] as const;
  }
  return [600, 950, 2500, 950, 1350, 700] as const;
}

export function getBootExitMs(profile: BootProfile): number {
  if (profile === "fast" || profile === "skip") return 220;
  return 450;
}

export function shouldBootTypewriter(profile: BootProfile): boolean {
  return profile === "full";
}

export function shouldBootVoice(profile: BootProfile): boolean {
  return profile === "full";
}

export function shouldShowBootSentinels(profile: BootProfile, phase: number): boolean {
  return profile === "full" && phase === 2;
}
