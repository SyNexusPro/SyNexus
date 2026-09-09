import { isNativeAndroid } from "../lib/bootExperience";

/**
 * In-app Trade / Swap. Default OFF.
 *
 * VITE_TRADING_ENABLED=true  — include /trade in this web build (local/web test).
 * VITE_TRADING_ANDROID=true  — also show Trade on native Android. Leave unset for
 * Play Store intelligence-only builds.
 *
 * Google Play: approving the current intelligence app does **not** approve a later
 * update that adds exchanging. Keep this flag false in the reviewed Play APK.
 */
export const TRADING_BUILD_ENABLED = import.meta.env.VITE_TRADING_ENABLED === "true";

export function isTradingEnabled(): boolean {
  if (!TRADING_BUILD_ENABLED) return false;
  if (isNativeAndroid() && import.meta.env.VITE_TRADING_ANDROID !== "true") {
    return false;
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
