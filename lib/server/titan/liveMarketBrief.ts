/**
 * Server-side live Solana market snapshot for Hera time-sensitive asks.
 * Uses the current DexScreener tokens/v1 route (no frontend API keys).
 */
import {
  bestPairByMint,
  collectSolanaMints,
  fetchDexJson,
  fetchPairsForMints,
  pairsFromDexPayload,
  type DexPair,
} from "../market/dexscreener.js";

export type LiveMarketCandidate = {
  symbol: string;
  name: string;
  priceUsd: number;
  change24hPct: number;
  change1hPct: number;
  change5mPct: number;
  volume24hUsd: number;
  liquidityUsd: number;
  mint?: string;
  score: number;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function scorePair(pair: DexPair): number {
  const liq = Number(pair.liquidity?.usd) || 0;
  const vol = Number(pair.volume?.h24) || 0;
  const ch24 = Number(pair.priceChange?.h24) || 0;
  const ch1 = Number(pair.priceChange?.h1) || 0;
  let score = 20;
  if (liq >= 500_000) score += 22;
  else if (liq >= 100_000) score += 16;
  else if (liq >= 40_000) score += 10;
  else if (liq < 15_000) score -= 18;
  if (vol >= 1_000_000) score += 18;
  else if (vol >= 250_000) score += 12;
  else if (vol >= 80_000) score += 7;
  if (ch24 > 0) score += Math.min(18, ch24 * 0.35);
  if (ch1 > 0) score += Math.min(10, ch1 * 0.5);
  const ch5 = Number(pair.priceChange?.m5) || 0;
  if (ch5 > 0) score += Math.min(8, ch5 * 0.4);
  if (ch5 > 25 && liq < 40_000) score -= 8;
  if (ch24 > 80 && liq < 50_000) score -= 12; // thin-book blowoff
  if (vol > 0 && liq > 0 && vol / liq >= 3) score += 6; // buying pressure proxy
  return clamp(score);
}

export function needsLiveMarketFetch(message: string, intentHint?: string | null): boolean {
  const lower = message.toLowerCase();
  if (intentHint === "market_movers") return true;
  return (
    /\b(best|strongest|top|watch|watching|moving|movers?|pumping|gainers?|hot|today|right now|rn)\b/.test(
      lower,
    ) &&
    /\b(coin|coins|token|tokens|crypto|solana|meme|memecoin|pair|market|ones?)\b/.test(lower)
  ) || /\bwhat('?s| is) (moving|pumping|hot|strong)\b/.test(lower)
    || /\bwhat should i watch\b/.test(lower)
    || /\bwhich (tokens?|coins?) (look|are) strong/.test(lower)
    || /\bbest ones?\b/.test(lower);
}

function formatAsOfClock(date: Date, timeZone?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : { timeZone: "UTC" }),
  };
  try {
    return date.toLocaleTimeString("en-US", opts);
  } catch {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "UTC",
      timeZoneName: "short",
    });
  }
}

export async function fetchLiveSolanaWatchlist(
  limit = 8,
  timeZone?: string | null,
): Promise<{
  asOfIso: string;
  source: string;
  candidates: LiveMarketCandidate[];
  brief: string;
}> {
  const mints = await collectSolanaMints(24);
  let byMint = bestPairByMint(await fetchPairsForMints(mints));

  if (byMint.size < 5) {
    try {
      const search = await fetchDexJson("https://api.dexscreener.com/latest/dex/search?q=SOL");
      byMint = bestPairByMint([...byMint.values(), ...pairsFromDexPayload(search)]);
    } catch {
      /* empty */
    }
  }

  const candidates: LiveMarketCandidate[] = [...byMint.values()]
    .map((pair) => {
      const liq = Number(pair.liquidity?.usd) || 0;
      const vol = Number(pair.volume?.h24) || 0;
      if (liq < 20_000 && vol < 50_000) return null;
      return {
        symbol: (pair.baseToken?.symbol || "UNKNOWN").toUpperCase(),
        name: pair.baseToken?.name || pair.baseToken?.symbol || "Unknown",
        priceUsd: Number(pair.priceUsd) || 0,
        change24hPct: Number(pair.priceChange?.h24) || 0,
        change1hPct: Number(pair.priceChange?.h1) || 0,
        change5mPct: Number(pair.priceChange?.m5) || 0,
        volume24hUsd: vol,
        liquidityUsd: liq,
        mint: pair.baseToken?.address,
        score: scorePair(pair),
      };
    })
    .filter((c): c is LiveMarketCandidate => Boolean(c))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const capturedAt = new Date();
  const asOfIso = capturedAt.toISOString();
  const asOfLocal = formatAsOfClock(capturedAt, timeZone);

  if (!candidates.length) {
    return {
      asOfIso,
      source: "dexscreener",
      candidates: [],
      brief: `LIVE MARKET DATA unavailable at ${asOfLocal} (${asOfIso}). Say live data could not be retrieved — do not invent rankings.`,
    };
  }

  const lines = candidates.map((c, i) => {
    const ch24 = `${c.change24hPct >= 0 ? "+" : ""}${c.change24hPct.toFixed(1)}%`;
    const ch1 = `${c.change1hPct >= 0 ? "+" : ""}${c.change1hPct.toFixed(1)}%`;
    const ch5 = `${c.change5mPct >= 0 ? "+" : ""}${c.change5mPct.toFixed(1)}%`;
    return `${i + 1}. $${c.symbol} ${c.name} (${ch5} 5m / ${ch1} 1h / ${ch24} 24h) · score ${c.score}/100 · vol $${Math.round(c.volume24hUsd).toLocaleString("en-US")} · liq $${Math.round(c.liquidityUsd).toLocaleString("en-US")}`;
  });

  const brief = [
    `LIVE MARKET SNAPSHOT captured at ${asOfLocal} (${asOfIso}, DexScreener Solana).`,
    "When answering 'best / strongest / watch today', reply in this shape:",
    "Here are the top performing tokens right now based on momentum, volume, liquidity, and safety score.",
    "1. $TICKER Name (+X.X%) — short why.",
    `End with EXACTLY: ✓ Data as of ${asOfLocal}`,
    "Copy that clock time character-for-character, including seconds. Do not round to the minute. Do not invent a different time.",
    "Ranked candidates (prefer healthier liquidity when scores are close):",
    ...lines,
  ].join("\n");

  return { asOfIso, source: "dexscreener", candidates, brief };
}
