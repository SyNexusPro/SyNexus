/**
 * Server-side live Solana market snapshot for Hera time-sensitive asks.
 * Reuses DexScreener public endpoints (no frontend API keys).
 */

export type LiveMarketCandidate = {
  symbol: string;
  name: string;
  priceUsd: number;
  change24hPct: number;
  change1hPct: number;
  volume24hUsd: number;
  liquidityUsd: number;
  mint?: string;
  score: number;
};

type DexPair = {
  chainId?: string;
  priceUsd?: string | number;
  volume?: { h24?: number; h1?: number };
  priceChange?: { h24?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
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

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`market_fetch_${res.status}`);
  return res.json();
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
  const byMint = new Map<string, DexPair>();

  try {
    const boosts = (await fetchJson("https://api.dexscreener.com/token-boosts/top/v1")) as Array<{
      tokenAddress?: string;
      chainId?: string;
    }>;
    const mints = (Array.isArray(boosts) ? boosts : [])
      .filter((b) => (b.chainId || "").toLowerCase() === "solana" && b.tokenAddress)
      .map((b) => b.tokenAddress!)
      .slice(0, 24);

    for (let i = 0; i < mints.length; i += 10) {
      const batch = mints.slice(i, i + 10);
      try {
        const data = (await fetchJson(
          `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`,
        )) as { pairs?: DexPair[] };
        for (const pair of data.pairs || []) {
          if ((pair.chainId || "").toLowerCase() !== "solana") continue;
          const mint = pair.baseToken?.address;
          if (!mint) continue;
          const prev = byMint.get(mint);
          const liq = Number(pair.liquidity?.usd) || 0;
          const prevLiq = Number(prev?.liquidity?.usd) || 0;
          if (!prev || liq > prevLiq) byMint.set(mint, pair);
        }
      } catch {
        /* continue */
      }
    }
  } catch {
    /* fall through to search */
  }

  if (byMint.size < 5) {
    try {
      const search = (await fetchJson(
        "https://api.dexscreener.com/latest/dex/search?q=SOL",
      )) as { pairs?: DexPair[] };
      for (const pair of search.pairs || []) {
        if ((pair.chainId || "").toLowerCase() !== "solana") continue;
        const mint = pair.baseToken?.address;
        if (!mint || mint === "So11111111111111111111111111111111111111112") continue;
        const prev = byMint.get(mint);
        const liq = Number(pair.liquidity?.usd) || 0;
        if ((Number(prev?.liquidity?.usd) || 0) < liq) byMint.set(mint, pair);
      }
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
    return `${i + 1}. $${c.symbol} ${c.name} (${ch24} 24h / ${ch1} 1h) · score ${c.score}/100 · vol $${Math.round(c.volume24hUsd).toLocaleString("en-US")} · liq $${Math.round(c.liquidityUsd).toLocaleString("en-US")}`;
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
