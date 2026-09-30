/**
 * In-app Trade / Swap. On for this SyNexus build so Trade is a main section.
 * Set VITE_TRADING_ENABLED=false to hide /trade and the nav item.
 */
export const TRADING_BUILD_ENABLED = import.meta.env.VITE_TRADING_ENABLED !== "false";

export function isTradingEnabled(): boolean {
  return TRADING_BUILD_ENABLED;
}

export function tradePath(opts?: { mint?: string | null; side?: "buy" | "sell" }): string {
  const params = new URLSearchParams();
  const mint = opts?.mint?.trim();
  if (mint) params.set("mint", mint);
  if (opts?.side) params.set("side", opts.side);
  const qs = params.toString();
  return qs ? `/trade?${qs}` : "/trade";
}
