/**
 * Wrapped SOL mint as used in Jupiter swap URLs (same value across major Solana UIs).
 * @see https://jup.ag/swap
 */
export const JUPITER_SOL_MINT = "So11111111111111111111111111111111111111112";

export type JupiterSwapOptions = {
  /** Platform fee in basis points (Synexus tier). Applied when VITE_JUPITER_FEE_ACCOUNT is configured. */
  feeBps?: number;
};

function jupiterSwapUrl(inputMint: string, outputMint: string, opts?: JupiterSwapOptions): string {
  const base = `https://jup.ag/swap/${inputMint}-${outputMint}`;
  const feeAccount = (import.meta.env.VITE_JUPITER_FEE_ACCOUNT ?? "").trim();
  const feeBps = opts?.feeBps;
  if (!feeAccount && (feeBps == null || feeBps <= 0)) return base;

  const params = new URLSearchParams();
  if (feeBps != null && feeBps > 0) params.set("feeBps", String(feeBps));
  if (feeAccount) params.set("feeAccount", feeAccount);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Jupiter preset: swap SOL → token (buy with SOL). */
export function jupiterBuyWithSolUrl(
  tokenMint: string | undefined | null,
  opts?: JupiterSwapOptions,
): string | null {
  const m = tokenMint?.trim();
  if (!m) return null;
  return jupiterSwapUrl(JUPITER_SOL_MINT, m, opts);
}

/** Jupiter preset: swap token → SOL (sell for SOL). */
export function jupiterSellForSolUrl(
  tokenMint: string | undefined | null,
  opts?: JupiterSwapOptions,
): string | null {
  const m = tokenMint?.trim();
  if (!m) return null;
  return jupiterSwapUrl(m, JUPITER_SOL_MINT, opts);
}

/** Charts & pair discovery — slower path; use when mint unknown. */
export function dexScreenerTokenUrl(tokenMint: string | undefined | null, symbolFallback: string): string {
  const m = tokenMint?.trim();
  if (m) return `https://dexscreener.com/solana/${m}`;
  return `https://dexscreener.com/search?q=${encodeURIComponent(symbolFallback)}`;
}
