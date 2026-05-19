/**
 * Wrapped SOL mint as used in Jupiter swap URLs (same value across major Solana UIs).
 * @see https://jup.ag/swap
 */
export const JUPITER_SOL_MINT = "So11111111111111111111111111111111111111112";

/** Jupiter preset: swap SOL → token (buy with SOL). */
export function jupiterBuyWithSolUrl(tokenMint: string | undefined | null): string | null {
  const m = tokenMint?.trim();
  if (!m) return null;
  return `https://jup.ag/swap/${JUPITER_SOL_MINT}-${m}`;
}

/** Jupiter preset: swap token → SOL (sell for SOL). */
export function jupiterSellForSolUrl(tokenMint: string | undefined | null): string | null {
  const m = tokenMint?.trim();
  if (!m) return null;
  return `https://jup.ag/swap/${m}-${JUPITER_SOL_MINT}`;
}

/** Charts & pair discovery — slower path; use when mint unknown. */
export function dexScreenerTokenUrl(tokenMint: string | undefined | null, symbolFallback: string): string {
  const m = tokenMint?.trim();
  if (m) return `https://dexscreener.com/solana/${m}`;
  return `https://dexscreener.com/search?q=${encodeURIComponent(symbolFallback)}`;
}
