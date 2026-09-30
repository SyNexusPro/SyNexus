/**
 * Current DexScreener public API (docs.dexscreener.com/api/reference).
 * Pair lookups use /tokens/v1/{chain}/{addresses}. Discovery feeds include
 * boosts, profile updates, and community takeovers.
 */

export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

export const DEX_SOLANA_DISCOVERY_FEEDS = [
  "https://api.dexscreener.com/token-boosts/top/v1",
  "https://api.dexscreener.com/token-boosts/latest/v1",
  "https://api.dexscreener.com/token-profiles/latest/v1",
  "https://api.dexscreener.com/token-profiles/recent-updates/v1",
  "https://api.dexscreener.com/community-takeovers/latest/v1",
] as const;

export type DexTokenRef = {
  url?: string;
  chainId?: string;
  tokenAddress?: string;
  description?: string;
  claimDate?: string;
  links?: Array<{ type?: string; label?: string; url?: string }>;
};

export type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  priceUsd?: string | number;
  txns?: {
    h24?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    m5?: { buys?: number; sells?: number };
  };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  boosts?: { active?: number };
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { socials?: unknown[]; websites?: unknown[] };
};

const BATCH = 30;

export async function fetchDexJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`dexscreener ${res.status} ${url}`);
  return res.json();
}

export function pairsFromDexPayload(data: unknown): DexPair[] {
  if (Array.isArray(data)) return data as DexPair[];
  if (data && typeof data === "object" && Array.isArray((data as { pairs?: unknown }).pairs)) {
    return (data as { pairs: DexPair[] }).pairs;
  }
  return [];
}

function solanaRefs(rows: unknown): DexTokenRef[] {
  if (!Array.isArray(rows)) return [];
  return (rows as DexTokenRef[]).filter(
    (row) => (row.chainId || "").toLowerCase() === "solana" && Boolean(row.tokenAddress?.trim()),
  );
}

/** Solana mints from the current discovery feeds, newest-style lists first. */
export async function collectSolanaMints(limit = 30): Promise<string[]> {
  const seen = new Set<string>();
  const mints: string[] = [];
  for (const url of DEX_SOLANA_DISCOVERY_FEEDS) {
    try {
      const rows = solanaRefs(await fetchDexJson(url));
      for (const row of rows) {
        const mint = row.tokenAddress!.trim();
        if (mint === WRAPPED_SOL_MINT || seen.has(mint)) continue;
        seen.add(mint);
        mints.push(mint);
        if (mints.length >= limit) return mints;
      }
    } catch {
      /* one feed failing should not blank the tape */
    }
  }
  return mints;
}

function chainRefs(rows: unknown): DexTokenRef[] {
  if (!Array.isArray(rows)) return [];
  return (rows as DexTokenRef[]).filter(
    (row) => Boolean(row.chainId?.trim()) && Boolean(row.tokenAddress?.trim()),
  );
}

export async function fetchDexTokenRefs(urls: readonly string[]): Promise<DexTokenRef[]> {
  const out: DexTokenRef[] = [];
  for (const url of urls) {
    try {
      out.push(...solanaRefs(await fetchDexJson(url)));
    } catch {
      /* optional feed */
    }
  }
  return out;
}

/** Latest profiles on every chain DexScreener includes in that feed. */
export async function fetchDexTokenRefsAllChains(urls: readonly string[]): Promise<DexTokenRef[]> {
  const out: DexTokenRef[] = [];
  for (const url of urls) {
    try {
      out.push(...chainRefs(await fetchDexJson(url)));
    } catch {
      /* optional feed */
    }
  }
  return out;
}

/** All Solana pairs for these mints via the current tokens/v1 route. */
export async function fetchPairsForMints(mints: string[]): Promise<DexPair[]> {
  const unique = [...new Set(mints.map((mint) => mint.trim()).filter(Boolean))];
  const pairs: DexPair[] = [];
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    try {
      const data = await fetchDexJson(
        `https://api.dexscreener.com/tokens/v1/solana/${batch.join(",")}`,
      );
      for (const pair of pairsFromDexPayload(data)) {
        if ((pair.chainId || "").toLowerCase() !== "solana") continue;
        pairs.push(pair);
      }
    } catch {
      /* next batch */
    }
  }
  return pairs;
}

export function bestPairByMint(pairs: DexPair[]): Map<string, DexPair> {
  const best = new Map<string, DexPair>();
  for (const pair of pairs) {
    const mint = pair.baseToken?.address?.trim();
    if (!mint || mint === WRAPPED_SOL_MINT) continue;
    const symbol = pair.baseToken?.symbol?.trim().toUpperCase();
    if (!symbol || symbol === "SOL" || symbol === "WSOL") continue;
    const prev = best.get(mint);
    const liq = Number(pair.liquidity?.usd) || 0;
    const prevLiq = Number(prev?.liquidity?.usd) || 0;
    if (!prev || liq > prevLiq) best.set(mint, pair);
  }
  return best;
}
