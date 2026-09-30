import type { DeepPartial, GuardianEngineConfig } from "../data/guardianEngine";
import { buildSampleTokens, type Token } from "../data/tokens";
import { SYN_MINT } from "../config/synToken";
import { guardApiFetch, guardTokenScan } from "../lib/securityBot";
import { isNativeAndroid } from "../lib/bootExperience";
import { nativeFeedCacheTtlMs } from "../lib/nativePerformance";
import { dedupeInFlight, readMoversCache, writeMoversCache } from "../lib/moversCache";
import type { MoverTimeframe } from "../lib/moverTimeframes";
import { loadGuardianConfigOverride } from "./guardianConfigService";
import { noteProviderHealth } from "../lib/synexus/eventBus";
import { isSolanaMint, resolveTokens } from "../lib/token/resolveTokens";
import { universalToToken } from "../lib/token/universalToken";

type TokenPatch = {
  priceUsd?: number;
  change24hPct?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  mintAddress?: string;
  logoUrl?: string;
};

type DexPair = {
  chainId?: string;
  baseToken?: { symbol?: string; name?: string; address?: string };
  info?: { imageUrl?: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h24?: number };
  volume?: { m5?: number; h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
};

export type TokenMover = {
  id: string;
  symbol: string;
  name: string;
  mintAddress: string;
  priceUsd: number;
  changePct: number;
  logoUrl?: string;
  liquidityUsd?: number;
};

export type TokenMover5m = TokenMover & { change5mPct: number };

export type SolanaMoversResult = {
  timeframe: MoverTimeframe;
  gainers: TokenMover[];
  losers: TokenMover[];
  source: FeedSource;
  updatedAt: number;
};

export type SolanaMoversBoard = Record<MoverTimeframe, SolanaMoversResult>;

export type Solana5mMoversResult = {
  gainers: TokenMover5m[];
  losers: TokenMover5m[];
  source: FeedSource;
  updatedAt: number;
};

const MIN_MOVER_LIQUIDITY_USD = 3_000;
const MOVER_POOL_SIZE = 30;
const MOVER_LIST_SIZE = 5;
const HISTORY_MOVER_POOL = 6;
const BIRDEYE_CONCURRENCY = 2;
const BIRDEYE_STAGGER_MS = 400;

const MOVER_CACHE_TTL_MS: Record<MoverTimeframe, number> = {
  "5m": 60_000,
  "24h": 120_000,
  "7d": 900_000,
  "30d": 900_000,
  "365d": 900_000,
};

const MOVER_HISTORY_CONFIG: Record<"7d" | "30d" | "365d", { seconds: number; type: string }> = {
  "7d": { seconds: 7 * 86400, type: "1H" },
  "30d": { seconds: 30 * 86400, type: "1D" },
  "365d": { seconds: 365 * 86400, type: "1W" },
};

type FeedSource = "live" | "mock" | "unavailable";

const PROVIDER_TIMEOUT_MS = 8_000;

async function fetchProvider(provider: string, url: string, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    noteProviderHealth(provider, response.ok, response.ok ? undefined : `HTTP ${response.status}`);
    return response;
  } catch (error) {
    noteProviderHealth(provider, false, error instanceof Error ? error.message : "request failed");
    throw error;
  }
}

function emptyMovers(timeframe: MoverTimeframe): SolanaMoversResult {
  return { timeframe, gainers: [], losers: [], source: "unavailable", updatedAt: Date.now() };
}

export type PriceHistoryRange = "1H" | "24H" | "1MO";

export type PriceHistoryPoint = {
  timestamp: number;
  /** Close price. */
  priceUsd: number;
  open?: number;
  high?: number;
  low?: number;
};

export type PriceHistoryResult = {
  range: PriceHistoryRange;
  points: PriceHistoryPoint[];
  source: FeedSource;
  /** Who produced the candles, when the series is live. */
  provider?: string;
  intervalLabel: string;
  windowLabel: string;
  updatedAt: number;
};

const HISTORY_CONFIG: Record<
  PriceHistoryRange,
  {
    seconds: number;
    type: string;
    intervalLabel: string;
    windowLabel: string;
    geckoTimeframe: "minute" | "hour" | "day";
    geckoAggregate: number;
    geckoLimit: number;
  }
> = {
  "1H": {
    seconds: 60 * 60,
    type: "1m",
    intervalLabel: "1-minute",
    windowLabel: "last hour",
    geckoTimeframe: "minute",
    geckoAggregate: 1,
    geckoLimit: 60,
  },
  "24H": {
    seconds: 24 * 60 * 60,
    type: "5m",
    intervalLabel: "5-minute",
    windowLabel: "last 24 hours",
    geckoTimeframe: "minute",
    geckoAggregate: 5,
    geckoLimit: 288,
  },
  "1MO": {
    seconds: 30 * 24 * 60 * 60,
    type: "1H",
    intervalLabel: "1-hour",
    windowLabel: "last 30 days",
    geckoTimeframe: "hour",
    geckoAggregate: 1,
    geckoLimit: 720,
  },
};

function toFiniteNumber(value: number | string | undefined): number | undefined {
  const numberValue =
    typeof value === "string" ? Number(value) : value;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function compactPatch(patch: TokenPatch): TokenPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as TokenPatch;
}

function patchFromDexPair(pair: DexPair): TokenPatch {
  const imageUrl = pair.info?.imageUrl?.trim();
  return compactPatch({
    priceUsd: toFiniteNumber(pair.priceUsd),
    change24hPct: toFiniteNumber(pair.priceChange?.h24),
    volume24hUsd: toFiniteNumber(pair.volume?.h24),
    liquidityUsd: toFiniteNumber(pair.liquidity?.usd),
    marketCapUsd: toFiniteNumber(pair.fdv),
    mintAddress: pair.baseToken?.address,
    logoUrl: imageUrl?.startsWith("http") ? imageUrl : undefined,
  });
}

function readHistoryPrice(item: Record<string, unknown>): number | undefined {
  return (
    toFiniteNumber(item.value as number | string | undefined) ??
    toFiniteNumber(item.price as number | string | undefined) ??
    toFiniteNumber(item.close as number | string | undefined) ??
    toFiniteNumber(item.c as number | string | undefined)
  );
}

function readHistoryTimestamp(item: Record<string, unknown>): number | undefined {
  const raw =
    toFiniteNumber(item.unixTime as number | string | undefined) ??
    toFiniteNumber(item.timestamp as number | string | undefined) ??
    toFiniteNumber(item.time as number | string | undefined);
  if (!raw) return undefined;
  return raw > 10_000_000_000 ? raw : raw * 1000;
}

async function fetchDexPairByAddress(address: string): Promise<DexPair | null> {
  let response: Response;
  try {
    response = await fetchProvider(
      "dexscreener",
      `https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(address)}`,
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const data = (await response.json()) as DexPair[] | { pairs?: DexPair[] };
  const pairs = Array.isArray(data) ? data : (data.pairs ?? []);
  return [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
}

async function fetchDexPairBySearch(symbol: string, name: string): Promise<DexPair | null> {
  const sameQuery = symbol.trim().toUpperCase() === name.trim().toUpperCase();
  const query = sameQuery ? symbol.trim() : `${symbol} ${name}`;
  let response: Response;
  try {
    response = await fetchProvider(
      "dexscreener",
      `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`,
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const data = (await response.json()) as { pairs?: DexPair[] };
  const best = (data.pairs ?? [])
    .filter((pair) => (pair.chainId ?? "").toLowerCase() === "solana")
    .filter((pair) => pair.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase())
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  return best ?? null;
}

async function fetchDexScreenerPatches(baseTokens: Token[]): Promise<{
  patches: Record<string, TokenPatch>;
  source: FeedSource;
  liveCount: number;
}> {
  try {
    const patches: Record<string, TokenPatch> = {};
    let liveCount = 0;
    const dexConcurrency = isNativeAndroid() ? 2 : 6;
    await mapWithConcurrency(baseTokens, dexConcurrency, async (token) => {
      const pair = token.mintAddress
        ? await fetchDexPairByAddress(token.mintAddress)
        : await fetchDexPairBySearch(token.symbol, token.name);
      if (!pair) return;
      patches[token.symbol.toUpperCase()] = patchFromDexPair(pair);
      liveCount += 1;
    });
    if (!liveCount) {
      throw new Error("DexScreener returned no matching pairs");
    }
    return { patches, source: "live", liveCount };
  } catch {
    return { source: "unavailable", liveCount: 0, patches: {} };
  }
}

async function fetchBirdeyePatches(): Promise<Record<string, TokenPatch>> {
  const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY;
  if (!apiKey) {
    return {
      SYN: { liquidityUsd: 1285730, marketCapUsd: 43198122 },
      SOL: { liquidityUsd: 156000000, marketCapUsd: 89200000000 },
    };
  }

  try {
    const response = await fetchProvider(
      "birdeye",
      `https://public-api.birdeye.so/defi/token_overview?address=${SYN_MINT}`,
      { headers: { "X-API-KEY": apiKey } },
    );
    if (!response.ok) throw new Error("Birdeye request failed");
    const data = (await response.json()) as {
      data?: { symbol?: string; liquidity?: number; marketCap?: number; price?: number };
    };
    const symbol = data.data?.symbol?.toUpperCase();
    if (!symbol) return {};
    return {
      [symbol]: {
        priceUsd: data.data?.price,
        liquidityUsd: data.data?.liquidity,
        marketCapUsd: data.data?.marketCap,
      },
    };
  } catch {
    return {};
  }
}

async function fetchSolanaRpcPatch(): Promise<TokenPatch> {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL;
  if (!endpoint) {
    return {
      mintAddress: SYN_MINT,
    };
  }

  try {
    const response = await fetchProvider("solana-rpc", endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [SYN_MINT, { encoding: "jsonParsed" }],
      }),
    });
    if (!response?.ok) throw new Error("RPC request failed");
    const data = (await response.json().catch(() => undefined)) as
      | { result?: unknown }
      | undefined;
    if (!data?.result) throw new Error("RPC returned no account data");
    // The response proves account accessibility; we keep pricing from market providers.
    return {};
  } catch {
    return {
      mintAddress: SYN_MINT,
    };
  }
}

function applyPatches(tokens: Token[], patches: Record<string, TokenPatch>): Token[] {
  return tokens.map((token) => {
    const patch = compactPatch(patches[token.symbol.toUpperCase()] ?? {});
    return patch ? { ...token, ...patch } : token;
  });
}

type GeckoPoolRow = {
  attributes?: { address?: string; reserve_in_usd?: string };
  relationships?: { base_token?: { data?: { id?: string } } };
};

function uniqueAscending(points: PriceHistoryPoint[]): PriceHistoryPoint[] {
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const unique: PriceHistoryPoint[] = [];
  for (const point of sorted) {
    const prev = unique[unique.length - 1];
    if (prev && Math.floor(prev.timestamp / 1000) === Math.floor(point.timestamp / 1000)) {
      unique[unique.length - 1] = point;
      continue;
    }
    unique.push(point);
  }
  return unique;
}

async function fetchGeckoPoolAddress(mint: string): Promise<string | null> {
  const response = await fetchProvider(
    "geckoterminal",
    `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}/pools?page=1`,
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { data?: GeckoPoolRow[] };
  const want = `solana_${mint}`;
  let best: { address: string; reserve: number } | null = null;
  for (const row of data.data ?? []) {
    if (row.relationships?.base_token?.data?.id !== want) continue;
    const address = row.attributes?.address?.trim();
    if (!address) continue;
    const reserve = Number(row.attributes?.reserve_in_usd) || 0;
    if (!best || reserve > best.reserve) best = { address, reserve };
  }
  return best?.address ?? null;
}

async function fetchGeckoCandles(mint: string, range: PriceHistoryRange): Promise<PriceHistoryPoint[]> {
  const pool = await fetchGeckoPoolAddress(mint);
  if (!pool) return [];
  const config = HISTORY_CONFIG[range];
  const response = await fetchProvider(
    "geckoterminal",
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${encodeURIComponent(pool)}/ohlcv/${config.geckoTimeframe}?aggregate=${config.geckoAggregate}&limit=${config.geckoLimit}&currency=usd`,
  );
  if (!response.ok) return [];
  const data = (await response.json()) as { data?: { attributes?: { ohlcv_list?: unknown[] } } };
  const rows = data.data?.attributes?.ohlcv_list ?? [];
  const points: PriceHistoryPoint[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const ts = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    if (![ts, open, high, low, close].every((value) => Number.isFinite(value)) || close <= 0) continue;
    points.push({
      timestamp: ts > 10_000_000_000 ? ts : ts * 1000,
      priceUsd: close,
      open,
      high,
      low,
    });
  }
  return uniqueAscending(points);
}

export async function fetchTokenPriceHistory(
  token: { mintAddress?: string },
  range: PriceHistoryRange,
): Promise<PriceHistoryResult> {
  const config = HISTORY_CONFIG[range];
  const now = Date.now();
  const mint = token.mintAddress?.trim();
  const empty = {
    range,
    points: [] as PriceHistoryPoint[],
    source: "unavailable" as const,
    intervalLabel: config.intervalLabel,
    windowLabel: config.windowLabel,
    updatedAt: now,
  };
  if (!mint) return empty;

  try {
    const points = await fetchGeckoCandles(mint, range);
    if (points.length >= 2) {
      return {
        range,
        points,
        source: "live",
        provider: "GeckoTerminal",
        intervalLabel: config.intervalLabel,
        windowLabel: config.windowLabel,
        updatedAt: now,
      };
    }
  } catch {
    /* Birdeye can still supply a close series. */
  }

  const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY;
  if (apiKey) {
    try {
      const from = Math.floor((now - config.seconds * 1000) / 1000);
      const to = Math.floor(now / 1000);
      const params = new URLSearchParams({
        address: mint,
        address_type: "token",
        type: config.type,
        time_from: String(from),
        time_to: String(to),
      });
      const response = await fetchProvider("birdeye", `https://public-api.birdeye.so/defi/history_price?${params}`, {
        headers: {
          "X-API-KEY": apiKey,
          "x-chain": "solana",
        },
      });
      if (!response.ok) throw new Error("Birdeye history request failed");
      const data = (await response.json()) as {
        data?: { items?: Record<string, unknown>[] };
      };
      const points = uniqueAscending(
        (data.data?.items ?? [])
          .map((item) => {
            const timestamp = readHistoryTimestamp(item);
            const priceUsd = readHistoryPrice(item);
            return timestamp && priceUsd ? { timestamp, priceUsd } : null;
          })
          .filter((point): point is PriceHistoryPoint => Boolean(point)),
      );
      if (points.length >= 2) {
        return {
          range,
          points,
          source: "live",
          provider: "Birdeye",
          intervalLabel: config.intervalLabel,
          windowLabel: config.windowLabel,
          updatedAt: now,
        };
      }
    } catch {
      /* Leave the chart empty rather than drawing a fake series. */
    }
  }

  return empty;
}

const MVP_FEED_CACHE_KEY = "mvp:feed";
const MVP_FEED_TTL_MS = nativeFeedCacheTtlMs(45_000);

async function fetchMvpTokenFeedUncached() {
  const guardianOverride = await loadGuardianConfigOverride();
  const baseTokens = buildSampleTokens(guardianOverride);
  const [dexResult, birdeyePatches, solanaPatch] = await Promise.all([
    fetchDexScreenerPatches(baseTokens),
    isNativeAndroid() ? Promise.resolve({} as Record<string, TokenPatch>) : fetchBirdeyePatches(),
    isNativeAndroid() ? Promise.resolve({ mintAddress: SYN_MINT } as TokenPatch) : fetchSolanaRpcPatch(),
  ]);

  const mergedPatches: Record<string, TokenPatch> = { ...dexResult.patches };
  for (const [symbol, patch] of Object.entries(birdeyePatches)) {
    mergedPatches[symbol] = { ...mergedPatches[symbol], ...patch };
  }
  mergedPatches.SYN = { ...mergedPatches.SYN, ...solanaPatch };

  const all = applyPatches(baseTokens, mergedPatches);
  const trending = all
    .slice()
    .sort((a, b) => b.change24hPct - a.change24hPct)
    .slice(0, 3);
  const alerts = all.filter((token) => token.guardianRisk !== "SAFE");
  const verified = all.filter((token) => token.guardianRisk === "SAFE");

  return {
    all,
    trending,
    alerts,
    verified,
    source: dexResult.source,
    dexLiveCount: dexResult.liveCount,
  };
}

export async function fetchMvpTokenFeed() {
  const cached = readMoversCache<Awaited<ReturnType<typeof fetchMvpTokenFeedUncached>>>(MVP_FEED_CACHE_KEY);
  if (cached) return cached;

  return dedupeInFlight(MVP_FEED_CACHE_KEY, async () => {
    const fresh = readMoversCache<Awaited<ReturnType<typeof fetchMvpTokenFeedUncached>>>(MVP_FEED_CACHE_KEY);
    if (fresh) return fresh;
    const result = await fetchMvpTokenFeedUncached();
    return writeMoversCache(MVP_FEED_CACHE_KEY, result, MVP_FEED_TTL_MS);
  });
}

async function resolvedSolanaTokens(query: string, pool?: Token[]): Promise<Token[]> {
  const hits = await resolveTokens(query, pool ?? []);
  return hits.filter((hit) => hit.chain === "solana" && hit.mint).map(universalToToken);
}

export async function lookupTokenByQuery(query: string, pool?: Token[]): Promise<Token | null> {
  const q = query.trim();
  if (!q) return null;

  const scanGuard = guardTokenScan(q);
  if (!scanGuard.allowed) return null;

  const apiGuard = guardApiFetch("dex-lookup");
  if (!apiGuard.allowed) return null;

  const hits = await resolvedSolanaTokens(q, pool);
  if (!hits.length) return null;
  if (isSolanaMint(q)) return hits.find((token) => token.mintAddress === q) ?? null;

  const exact = hits.filter((token) => token.symbol.toUpperCase() === q.toUpperCase());
  const list = exact.length ? exact : hits;
  return list.length === 1 ? (list[0] ?? null) : null;
}

/** Lightweight token search for Trade — Dex + existing feed, no new APIs. */
export async function searchTradeTokens(query: string, pool?: Token[]): Promise<Token[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const scanGuard = guardTokenScan(q);
  if (!scanGuard.allowed) return [];

  const apiGuard = guardApiFetch("dex-lookup");
  if (!apiGuard.allowed) return [];

  try {
    return (await resolvedSolanaTokens(q, pool)).slice(0, 8);
  } catch {
    return [];
  }
}

export async function fetchTokenDetailById(tokenId: string) {
  const feed = await fetchMvpTokenFeed();
  const hit =
    feed.all.find((token) => token.id === tokenId) ??
    feed.all.find((token) => token.mintAddress === tokenId);
  if (hit) return hit;
  return lookupTokenByQuery(tokenId, feed.all);
}

export async function previewTokensWithGuardianConfig(
  override?: DeepPartial<GuardianEngineConfig>,
) {
  return buildSampleTokens(override);
}

type DexBoostEntry = {
  chainId?: string;
  tokenAddress?: string;
};

function moverFromDexPair(pair: DexPair, changePct: number): TokenMover | null {
  const mintAddress = pair.baseToken?.address?.trim();
  const priceUsd = toFiniteNumber(pair.priceUsd) ?? 0;
  const liquidityUsd = toFiniteNumber(pair.liquidity?.usd);
  if (!mintAddress || !Number.isFinite(changePct)) return null;
  if ((liquidityUsd ?? 0) < MIN_MOVER_LIQUIDITY_USD) return null;

  const symbol = pair.baseToken?.symbol?.trim() || "???";
  const name = pair.baseToken?.name?.trim() || symbol;
  const imageUrl = pair.info?.imageUrl?.trim();

  return {
    id: mintAddress,
    symbol,
    name,
    mintAddress,
    priceUsd,
    changePct,
    liquidityUsd,
    logoUrl: imageUrl?.startsWith("http") ? imageUrl : undefined,
  };
}

function pickBestMoverPairs(
  pairs: DexPair[],
  readChangePct: (pair: DexPair) => number | undefined,
): TokenMover[] {
  const bestByMint = new Map<string, DexPair>();
  for (const pair of pairs) {
    const mint = pair.baseToken?.address?.trim();
    if (!mint) continue;
    const existing = bestByMint.get(mint);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      bestByMint.set(mint, pair);
    }
  }
  return [...bestByMint.values()]
    .map((pair) => {
      const changePct = readChangePct(pair);
      return changePct === undefined ? null : moverFromDexPair(pair, changePct);
    })
    .filter((mover): mover is TokenMover => Boolean(mover));
}

function rankMovers(movers: TokenMover[], listSize = MOVER_LIST_SIZE): Pick<SolanaMoversResult, "gainers" | "losers"> {
  const gainers = movers
    .filter((mover) => mover.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, listSize);
  const losers = movers
    .filter((mover) => mover.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, listSize);
  return { gainers, losers };
}

function toMover5m(mover: TokenMover): TokenMover5m {
  return { ...mover, change5mPct: mover.changePct };
}

async function fetchDexBoostAddresses(): Promise<string[]> {
  const [topRes, latestRes] = await Promise.all([
    fetchProvider("dexscreener", "https://api.dexscreener.com/token-boosts/top/v1").catch(() => null),
    fetchProvider("dexscreener", "https://api.dexscreener.com/token-boosts/latest/v1").catch(() => null),
  ]);
  const top = topRes?.ok ? ((await topRes.json()) as DexBoostEntry[]) : [];
  const latest = latestRes?.ok ? ((await latestRes.json()) as DexBoostEntry[]) : [];
  const merged = [...(Array.isArray(top) ? top : []), ...(Array.isArray(latest) ? latest : [])];
  const addresses: string[] = [];
  const seen = new Set<string>();
  for (const entry of merged) {
    if (entry.chainId !== "solana") continue;
    const address = entry.tokenAddress?.trim();
    if (!address || seen.has(address)) continue;
    seen.add(address);
    addresses.push(address);
    if (addresses.length >= MOVER_POOL_SIZE) break;
  }
  return addresses;
}

async function fetchDexPairsBatch(addresses: string[]): Promise<DexPair[]> {
  if (!addresses.length) return [];
  let response: Response;
  try {
    response = await fetchProvider(
      "dexscreener",
      `https://api.dexscreener.com/tokens/v1/solana/${addresses.join(",")}`,
    );
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const data = (await response.json()) as DexPair[] | { pairs?: DexPair[] };
  if (Array.isArray(data)) return data;
  return data.pairs ?? [];
}

async function fetchDexMoverPool(): Promise<{ pairs: DexPair[]; source: FeedSource }> {
  return dedupeInFlight("dex:mover-pool", async () => {
    const addresses = await fetchDexBoostAddresses();
    if (!addresses.length) throw new Error("No boosted Solana tokens");
    const pairs = await fetchDexPairsBatch(addresses);
    if (!pairs.length) throw new Error("DexScreener returned no pairs");
    return { pairs, source: "live" as FeedSource };
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
}

async function fetchPeriodChangePct(mintAddress: string, seconds: number, type: string): Promise<number | null> {
  const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY;
  if (!apiKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const from = now - seconds;
  const params = new URLSearchParams({
    address: mintAddress,
    address_type: "token",
    type,
    time_from: String(from),
    time_to: String(now),
  });

  try {
    const response = await fetchProvider("birdeye", `https://public-api.birdeye.so/defi/history_price?${params}`, {
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: { items?: Record<string, unknown>[] } };
    const items = data.data?.items ?? [];
    if (items.length < 2) return null;

    const firstPrice = readHistoryPrice(items[0]!);
    const lastPrice = readHistoryPrice(items[items.length - 1]!);
    if (!firstPrice || !lastPrice || firstPrice <= 0) return null;
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  } catch {
    return null;
  }
}

async function fetchHistoricalMovers(
  pairs: DexPair[],
  timeframe: "7d" | "30d" | "365d",
): Promise<TokenMover[]> {
  const config = MOVER_HISTORY_CONFIG[timeframe];
  const candidates = pickBestMoverPairs(pairs, (pair) => toFiniteNumber(pair.priceChange?.h24) ?? 0)
    .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))
    .slice(0, HISTORY_MOVER_POOL);

  const movers: TokenMover[] = [];
  await mapWithConcurrency(candidates, BIRDEYE_CONCURRENCY, async (base, index) => {
    if (index > 0) await sleep(BIRDEYE_STAGGER_MS);
    const changePct = await fetchPeriodChangePct(base.mintAddress, config.seconds, config.type);
    if (changePct == null || !Number.isFinite(changePct)) return;
    movers.push({ ...base, changePct });
  });

  return movers;
}

export async function fetchSolanaTopMovers(timeframe: MoverTimeframe): Promise<SolanaMoversResult> {
  const cacheKey = `movers:${timeframe}`;
  const cached = readMoversCache<SolanaMoversResult>(cacheKey);
  if (cached) return cached;

  return dedupeInFlight(cacheKey, async () => {
    const apiGuard = guardApiFetch(`dex-movers-${timeframe}`);
    if (!apiGuard.allowed) return emptyMovers(timeframe);

    try {
      const { pairs } = await fetchDexMoverPool();

      if (timeframe === "5m" || timeframe === "24h") {
        const readChange =
          timeframe === "5m"
            ? (pair: DexPair) => toFiniteNumber(pair.priceChange?.m5)
            : (pair: DexPair) => toFiniteNumber(pair.priceChange?.h24);
        const movers = pickBestMoverPairs(pairs, readChange);
        if (!movers.length) throw new Error("No movers passed liquidity filter");
        const ranked = rankMovers(movers);
        return writeMoversCache(
          cacheKey,
          { timeframe, ...ranked, source: "live", updatedAt: Date.now() },
          nativeFeedCacheTtlMs(MOVER_CACHE_TTL_MS[timeframe]),
        );
      }

      const movers = await fetchHistoricalMovers(pairs, timeframe);
      if (!movers.length) throw new Error("No historical movers");
      const ranked = rankMovers(movers);
      return writeMoversCache(
        cacheKey,
        { timeframe, ...ranked, source: "live", updatedAt: Date.now() },
        MOVER_CACHE_TTL_MS[timeframe],
      );
    } catch {
      return emptyMovers(timeframe);
    }
  });
}

function buildBoardFromCaches(): SolanaMoversBoard {
  return {
    "5m": readMoversCache("movers:5m") ?? emptyMovers("5m"),
    "24h": readMoversCache("movers:24h") ?? emptyMovers("24h"),
    "7d": readMoversCache("movers:7d") ?? emptyMovers("7d"),
    "30d": readMoversCache("movers:30d") ?? emptyMovers("30d"),
    "365d": readMoversCache("movers:365d") ?? emptyMovers("365d"),
  };
}

/** Load week/month/year movers in the background — never blocks UI. */
function hydrateHistoricalMoversBoard(): void {
  void dedupeInFlight("movers:hydrate", async () => {
    for (const timeframe of ["7d", "30d", "365d"] as const) {
      if (readMoversCache(`movers:${timeframe}`)) continue;
      await fetchSolanaTopMovers(timeframe);
      await sleep(1200);
    }
    writeMoversCache("movers:board", buildBoardFromCaches(), MOVER_CACHE_TTL_MS["7d"]);
  });
}

export async function fetchSolanaMoversBoard(): Promise<SolanaMoversBoard> {
  const cached = readMoversCache<SolanaMoversBoard>("movers:board");
  if (cached) return cached;

  return dedupeInFlight("movers:board", async () => {
    const [fiveM, day] = await Promise.all([
      fetchSolanaTopMovers("5m"),
      fetchSolanaTopMovers("24h"),
    ]);

    const board: SolanaMoversBoard = {
      "5m": fiveM,
      "24h": day,
      "7d": readMoversCache("movers:7d") ?? emptyMovers("7d"),
      "30d": readMoversCache("movers:30d") ?? emptyMovers("30d"),
      "365d": readMoversCache("movers:365d") ?? emptyMovers("365d"),
    };

    writeMoversCache("movers:board", board, 120_000);
    hydrateHistoricalMoversBoard();
    return board;
  });
}

export async function fetchSolana5mMovers(): Promise<Solana5mMoversResult> {
  const result = await fetchSolanaTopMovers("5m");
  return {
    gainers: result.gainers.map(toMover5m),
    losers: result.losers.map(toMover5m),
    source: result.source,
    updatedAt: result.updatedAt,
  };
}
