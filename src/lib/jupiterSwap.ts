import { PublicKey } from "@solana/web3.js";
import { JUPITER_SOL_MINT } from "./solanaTradeLinks";
import { getSolanaConnection } from "./solanaWallet";

const LITE_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";
const V6_QUOTE = "https://quote-api.jup.ag/v6/quote";
const V6_SWAP = "https://quote-api.jup.ag/v6/swap";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const decimalsCache = new Map<string, number>();

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
  const cached = decimalsCache.get(mint);
  if (cached != null) return cached;

  const connection = getSolanaConnection();
  const info = await connection.getParsedAccountInfo(new PublicKey(mint));
  const parsed = info.value?.data;
  let decimals = 6;
  if (parsed && typeof parsed === "object" && "parsed" in parsed) {
    const d = (parsed.parsed as { info?: { decimals?: number } })?.info?.decimals;
    if (typeof d === "number") decimals = d;
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

export async function fetchJupiterQuote(opts: {
  inputMint: string;
  outputMint: string;
  amountAtomic: bigint;
  slippageBps: number;
  platformFeeBps?: number;
}): Promise<SwapQuoteView> {
  if (opts.amountAtomic <= 0n) throw new Error("Enter an amount to swap.");
  if (opts.inputMint === opts.outputMint) throw new Error("Choose two different tokens.");

  const params = new URLSearchParams({
    inputMint: opts.inputMint,
    outputMint: opts.outputMint,
    amount: opts.amountAtomic.toString(),
    slippageBps: String(opts.slippageBps),
    restrictIntermediateTokens: "true",
  });
  const feeAccount = jupiterFeeAccount();
  const feeBps = opts.platformFeeBps ?? 0;
  const applyFee = Boolean(feeAccount && feeBps > 0);
  if (applyFee) params.set("platformFeeBps", String(feeBps));

  let quote: JupiterQuoteResponse;
  try {
    quote = await fetchQuoteFrom(LITE_QUOTE, params);
  } catch {
    quote = await fetchQuoteFrom(V6_QUOTE, params);
  }

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
  const feeAccount = jupiterFeeAccount();
  const body: Record<string, unknown> = {
    quoteResponse: opts.quote,
    userPublicKey: opts.userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    dynamicSlippage: true,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        maxLamports: 1_000_000,
        priorityLevel: "high",
      },
    },
  };
  if (feeAccount) body.feeAccount = feeAccount;

  async function post(url: string): Promise<JupiterSwapBuild> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as JupiterSwapBuild & { error?: string; message?: string };
    if (!response.ok || !data.swapTransaction) {
      throw new Error(data.error || data.message || `Jupiter swap build failed (${response.status})`);
    }
    return data;
  }

  try {
    return await post(LITE_SWAP);
  } catch {
    return await post(V6_SWAP);
  }
}

export function estimateNetworkCostSol(build: JupiterSwapBuild | null): number {
  const prio = build?.prioritizationFeeLamports ?? 0;
  const base = 5_000;
  return (prio + base) / 1_000_000_000;
}
