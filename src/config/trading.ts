import { Capacitor } from "@capacitor/core";

/**
 * In-app Trade / Swap for the first public release stays OFF unless explicitly enabled.
 * Set VITE_TRADING_ENABLED=true only after authorization. Native Android also requires
 * VITE_TRADING_ANDROID=true.
 */
export const TRADING_BUILD_ENABLED = String(import.meta.env.VITE_TRADING_ENABLED || "").trim().toLowerCase() === "true";

export function isTradingEnabled(): boolean {
  if (!TRADING_BUILD_ENABLED) return false;
  if (Capacitor.getPlatform() === "android") {
    return String(import.meta.env.VITE_TRADING_ANDROID || "").trim().toLowerCase() === "true";
  }
  return true;
}

export function tradePath(opts?: { mint?: string | null; side?: "buy" | "sell" }): string {
  const params = new URLSearchParams();
  const mint = opts?.mint?.trim();
  if (mint) params.set("mint", mint);
  if (opts?.side) params.set("side", opts.side);
  const qs = params.toString();
  return qs ? `/trade?${qs}` : "/trade";
}
