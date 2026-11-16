import { PublicKey } from "@solana/web3.js";
import { SYN_MINT } from "../config/synToken";
import { authHeaders } from "./authSession";
import { JUPITER_SOL_MINT } from "./solanaTradeLinks";
import { getSolanaConnection } from "./solanaWallet";

const LITE_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const V6_QUOTE = "https://quote-api.jup.ag/v6/quote";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const decimalsCache = new Map<string, number>();
const quoteTokens = new WeakMap<JupiterQuoteResponse, string>();

export type JupiterQuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold?: string;
  swapMode?: string;
  slippageBps?: number;
  priceImpactPct?: string | number;
  routePlan?: unknown[];
  platformFee?: { amount?: string; feeBps?: number } | null;
};

export type JupiterSwapBuild = {
  swapTransaction: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
};

export type SwapQuoteView = {
  quote: JupiterQuoteResponse;
  inAmountUi: number;
  outAmountUi: number;
  minOutUi: number;
  priceImpactPct: number;
  inDecimals: number;
  outDecimals: number;
  routeHops: number;
  platformFeeBps: number;
  platformFeeApplied: boolean;
};

export function jupiterFeeAccount(): string {
  return (import.meta.env.VITE_JUPITER_FEE_ACCOUNT ?? "").trim();
}

export async function getMintDecimals(mint: string): Promise<number> {
  if (mint === JUPITER_SOL_MINT) return 9;
  if (mint === USDC_MINT || mint === SYN_MINT) return 6;
  const cached = decimalsCache.get(mint);
  if (cached != null) return cached;

  let decimals = 6;
  try {
    const connection = getSolanaConnection();
    const info = await connection.getParsedAccountInfo(new PublicKey(mint));
    const parsed = info.value?.data;
    if (parsed && typeof parsed === "object" && "parsed" in parsed) {
      const d = (parsed.parsed as { info?: { decimals?: number } })?.info?.decimals;
      if (typeof d === "number") decimals = d;
    }
  } catch {
    decimals = 6;
  }
  decimalsCache.set(mint, decimals);
  return decimals;
}

function parseImpact(raw: string | number | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function fetchQuoteFrom(url: string, params: URLSearchParams): Promise<JupiterQuoteResponse> {
  const response = await fetch(`${url}?${params.toString()}`);
  const data = (await response.json()) as JupiterQuoteResponse & { error?: string; message?: string };
  if (!response.ok || data.error || !data.outAmount) {
    throw new Error(data.error || data.message || `Jupiter quote failed (${response.status})`);
  }
  return data;
}

void fetchQuoteFrom;
void LITE_QUOTE;
void V6_QUOTE;

export async function fetchJupiterQuote(opts: {
  inputMint: string;
  outputMint: string;
  amountAtomic: bigint;
  slippageBps: number;
  platformFeeBps?: number;
}): Promise<SwapQuoteView> {
  if (opts.amountAtomic <= 0n) throw new Error("Enter an amount to swap.");
  if (opts.inputMint === opts.outputMint) throw new Error("Choose two different tokens.");
  void opts.platformFeeBps;

  const response = await fetch("/api/trade/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      inputMint: opts.inputMint,
      outputMint: opts.outputMint,
      amount: opts.amountAtomic.toString(),
      slippageBps: opts.slippageBps,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    quote?: JupiterQuoteResponse;
    quoteToken?: string;
    platformFeeBps?: number;
    platformFeeApplied?: boolean;
    error?: string;
  } | null;
  if (!response.ok || !data?.quote?.outAmount || !data.quoteToken) {
    throw new Error(data?.error || "SyNexus could not price this swap.");
  }
  const quote = data.quote;
  quoteTokens.set(quote, data.quoteToken);
  const feeBps = data.platformFeeBps ?? 0;
  const applyFee = Boolean(data.platformFeeApplied);

  const [inDecimals, outDecimals] = await Promise.all([
    getMintDecimals(opts.inputMint),
    getMintDecimals(opts.outputMint),
  ]);

  const outAmount = Number(quote.outAmount);
  const minOut = Number(quote.otherAmountThreshold ?? quote.outAmount);

  return {
    quote,
    inAmountUi: Number(quote.inAmount) / 10 ** inDecimals,
    outAmountUi: outAmount / 10 ** outDecimals,
    minOutUi: minOut / 10 ** outDecimals,
    priceImpactPct: parseImpact(quote.priceImpactPct),
    inDecimals,
    outDecimals,
    routeHops: Array.isArray(quote.routePlan) ? quote.routePlan.length : 0,
    platformFeeBps: applyFee ? feeBps : 0,
    platformFeeApplied: applyFee,
  };
}

export async function buildJupiterSwapTransaction(opts: {
  quote: JupiterQuoteResponse;
  userPublicKey: string;
}): Promise<JupiterSwapBuild> {
  const quoteToken = quoteTokens.get(opts.quote);
  if (!quoteToken) throw new Error("Request a new quote before swapping.");
  const response = await fetch("/api/trade/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ quote: opts.quote, quoteToken, userPublicKey: opts.userPublicKey }),
  });
  const data = (await response.json().catch(() => null)) as JupiterSwapBuild & { error?: string };
  if (!response.ok || !data?.swapTransaction) {
    throw new Error(data?.error || "SyNexus could not build this swap.");
  }
  return data;
}

export function estimateNetworkCostSol(build: JupiterSwapBuild | null): number {
  const prio = build?.prioritizationFeeLamports ?? 0;
  const base = 5_000;
  return (prio + base) / 1_000_000_000;
}
