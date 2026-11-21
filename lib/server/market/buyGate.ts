/**
 * Backend screen for swaps. A passing result is not a promise that a token is safe.
 * Exits into SOL, USDC, or USDT stay available even when the token would fail a buy.
 */
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const EXIT_MINTS = new Set([SOL_MINT, USDC_MINT, USDT_MINT]);

export type BuyScreen = {
  kind: "exit" | "buy";
  allowed: boolean;
  guarantee: false;
  checkedAt: string;
  listed: boolean | null;
  priceUsd: number | null;
  reasons: string[];
  note: string;
};

type FetchLike = typeof fetch;

const EXIT_NOTE = "This exit stays available. A screening result does not guarantee the token is safe.";
const CLEAR_NOTE = "The current screen found no listed block. That does not guarantee this token is safe.";
const UNLISTED_NOTE = "GoPlus has no current record for this token. That absence is not a safety clearance, so the buy is not opened.";
const DOWN_NOTE = "The security screen did not answer, so this buy was not opened. This is not a finding that the token is safe or unsafe.";

function statusOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { status?: unknown }).status === "string") {
    return (value as { status: string }).status;
  }
  return null;
}

export function isExitMint(mint: string): boolean {
  return EXIT_MINTS.has(mint);
}

export function screenFromGoPlus(mint: string, payload: unknown, checkedAt: string): BuyScreen {
  const body = payload && typeof payload === "object" ? payload as { code?: unknown; result?: unknown } : null;
  if (!body || body.code !== 1 || !body.result || typeof body.result !== "object") {
    return { kind: "buy", allowed: false, guarantee: false, checkedAt, listed: null, priceUsd: null, reasons: ["screening_unavailable"], note: DOWN_NOTE };
  }
  const result = body.result as Record<string, unknown>;
  const row = result[mint] ?? result[mint.toLowerCase()];
  if (!row || typeof row !== "object") {
    return { kind: "buy", allowed: false, guarantee: false, checkedAt, listed: false, priceUsd: null, reasons: ["no_current_record"], note: UNLISTED_NOTE };
  }
  const token = row as Record<string, unknown>;
  const trusted = token.trusted_token === 1 || token.trusted_token === "1";
  const reasons: string[] = [];
  if (statusOf(token.non_transferable) === "1") reasons.push("non_transferable");
  if (!trusted && statusOf(token.freezable) === "1") reasons.push("freeze_authority");
  if (!trusted && statusOf(token.closable) === "1") reasons.push("closable");
  if (!trusted && Array.isArray(token.transfer_hook) && token.transfer_hook.length > 0) reasons.push("transfer_hook");
  return {
    kind: "buy",
    allowed: reasons.length === 0,
    guarantee: false,
    checkedAt,
    listed: true,
    priceUsd: null,
    reasons,
    note: reasons.length === 0 ? CLEAR_NOTE : `The current screen blocked this buy: ${reasons.join(", ")}. This does not guarantee every other token is safe.`,
  };
}

export function withCoinGeckoPrice(screen: BuyScreen, mint: string, payload: unknown): BuyScreen {
  const body = payload && typeof payload === "object" ? payload as Record<string, { usd?: unknown }> : null;
  const row = body?.[mint] ?? body?.[mint.toLowerCase()];
  const usd = row && typeof row.usd === "number" && Number.isFinite(row.usd) ? row.usd : null;
  return { ...screen, priceUsd: usd };
}

export async function assessSwap(
  outputMint: string,
  fetchImpl: FetchLike = fetch,
  now = new Date(),
): Promise<BuyScreen> {
  const checkedAt = now.toISOString();
  if (isExitMint(outputMint)) {
    return { kind: "exit", allowed: true, guarantee: false, checkedAt, listed: null, priceUsd: null, reasons: [], note: EXIT_NOTE };
  }
  let goplus: unknown = null;
  try {
    const response = await fetchImpl(
      `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(outputMint)}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
    );
    goplus = response.ok ? await response.json() : null;
  } catch {
    goplus = null;
  }
  const screen = screenFromGoPlus(outputMint, goplus, checkedAt);
  if (!screen.allowed) return screen;
  try {
    const response = await fetchImpl(
      `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${encodeURIComponent(outputMint)}&vs_currencies=usd`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return screen;
    return withCoinGeckoPrice(screen, outputMint, await response.json());
  } catch {
    return screen;
  }
}
