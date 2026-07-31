import type { DeepPartial, GuardianEngineConfig } from "../data/guardianEngine";
import { buildSampleTokens, buildTokenFromPartial, type Token } from "../data/tokens";
import { SYN_MINT } from "../config/synToken";
import { guardApiFetch, guardTokenScan } from "../lib/securityBot";
import { readMoversCache, writeMoversCache } from "../lib/moversCache";
import type { MoverTimeframe } from "../lib/moverTimeframes";
import { MOVER_TIMEFRAMES } from "../lib/moverTimeframes";
import { loadGuardianConfigOverride } from "./guardianConfigService";

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
const HISTORY_MOVER_POOL = 12;

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

type FeedSource = "live" | "mock";

export type PriceHistoryRange = "1H" | "24H" | "1MO";

export type PriceHistoryPoint = {
  timestamp: number;
  priceUsd: number;
};

export type PriceHistoryResult = {
  range: PriceHistoryRange;
  points: PriceHistoryPoint[];
  source: FeedSource;
  intervalLabel: string;
  windowLabel: string;
  updatedAt: number;
};

const HISTORY_CONFIG: Record<
  PriceHistoryRange,
  { seconds: number; type: string; intervalLabel: string; windowLabel: string; fallbackPoints: number }
> = {
  "1H": {
    seconds: 60 * 60,
    type: "1m",
    intervalLabel: "1-minute",
    windowLabel: "last hour",
    fallbackPoints: 60,
  },
  "24H": {
    seconds: 24 * 60 * 60,
    type: "5m",
    intervalLabel: "5-minute",
    windowLabel: "last 24 hours",
    fallbackPoints: 96,
  },
  "1MO": {
    seconds: 30 * 24 * 60 * 60,
    type: "1H",
    intervalLabel: "1-hour",
    windowLabel: "last 30 days",
    fallbackPoints: 90,
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

function generateFallbackHistory(token: Token, range: PriceHistoryRange): PriceHistoryPoint[] {
  const config = HISTORY_CONFIG[range];
  const now = Date.now();
  const start = now - config.seconds * 1000;
  const count = config.fallbackPoints;
  const currentPrice = token.priceUsd;
  const totalChangePct = token.change24hPct / 100;
  const startPrice = currentPrice / (1 + totalChangePct || 1);

  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 1 : index / (count - 1);
    const wave = Math.sin(progress * Math.PI * 4 + token.symbol.length) * 0.012;
    const pulse = Math.cos(progress * Math.PI * 7 + token.name.length) * 0.006;
    const priceUsd = startPrice + (currentPrice - startPrice) * progress;

    return {
      timestamp: Math.round(start + (now - start) * progress),
      priceUsd: Math.max(0, priceUsd * (1 + wave + pulse)),
    };
  });
}

async function fetchDexPairByAddress(address: string): Promise<DexPair | null> {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { pairs?: DexPair[] };
  return (data.pairs ?? [])[0] ?? null;
}

async function fetchDexPairBySearch(symbol: string, name: string): Promise<DexPair | null> {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(`${symbol} ${name}`)}`,
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { pairs?: DexPair[] };
  const best = (data.pairs ?? [])
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
    await Promise.all(
      baseTokens.map(async (token) => {
        const pair = token.mintAddress
          ? await fetchDexPairByAddress(token.mintAddress)
          : await fetchDexPairBySearch(token.symbol, token.name);
        if (!pair) return;
        patches[token.symbol.toUpperCase()] = patchFromDexPair(pair);
        liveCount += 1;
      }),
    );
    if (!liveCount) {
      throw new Error("DexScreener returned no matching pairs");
    }
    return { patches, source: "live", liveCount };
  } catch {
    // Mock fallback path
    return {
      source: "mock",
      liveCount: 0,
      patches: {
        HIVE: {
          priceUsd: 0.00432,
          change24hPct: 5.92,
          volume24hUsd: 482364,
          liquidityUsd: 1285730,
          marketCapUsd: 43198122,
          mintAddress: SYN_MINT,
        },
        BONK: { priceUsd: 0.00003412, change24hPct: -6.42, volume24hUsd: 61000000 },
        PEPE: { priceUsd: 0.00001078, change24hPct: 8.33, volume24hUsd: 138000000 },
      },
    };
  }
}

async function fetchBirdeyePatches(): Promise<Record<string, TokenPatch>> {
  const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY;
  if (!apiKey) {
    return {
      HIVE: { liquidityUsd: 1285730, marketCapUsd: 43198122 },
      SOL: { liquidityUsd: 156000000, marketCapUsd: 89200000000 },
    };
  }

  try {
    const response = await fetch(
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
    const response = await fetch(endpoint, {
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

export async function fetchTokenPriceHistory(
  token: Token,
  range: PriceHistoryRange,
): Promise<PriceHistoryResult> {
  const config = HISTORY_CONFIG[range];
  const now = Date.now();
  const from = Math.floor((now - config.seconds * 1000) / 1000);
  const to = Math.floor(now / 1000);
  const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY;

  if (apiKey && token.mintAddress) {
    try {
      const params = new URLSearchParams({
        address: token.mintAddress,
        address_type: "token",
        type: config.type,
        time_from: String(from),
        time_to: String(to),
      });
      const response = await fetch(`https://public-api.birdeye.so/defi/history_price?${params}`, {
        headers: {
          "X-API-KEY": apiKey,
          "x-chain": "solana",
        },
      });
      if (!response.ok) throw new Error("Birdeye history request failed");
      const data = (await response.json()) as {
        data?: { items?: Record<string, unknown>[] };
      };
      const points = (data.data?.items ?? [])
        .map((item) => {
          const timestamp = readHistoryTimestamp(item);
          const priceUsd = readHistoryPrice(item);
          return timestamp && priceUsd ? { timestamp, priceUsd } : null;
        })
        .filter((point): point is PriceHistoryPoint => Boolean(point))
        .sort((a, b) => a.timestamp - b.timestamp);

      if (points.length >= 2) {
        return {
          range,
          points,
          source: "live",
          intervalLabel: config.intervalLabel,
          windowLabel: config.windowLabel,
          updatedAt: now,
        };
      }
    } catch {
      // Fall through to generated history so the chart stays usable.
    }
  }

  return {
    range,
    points: generateFallbackHistory(token, range),
    source: "mock",
    intervalLabel: config.intervalLabel,
    windowLabel: config.windowLabel,
    updatedAt: now,
  };
}

export async function fetchMvpTokenFeed() {
  const guardianOverride = await loadGuardianConfigOverride();
  const baseTokens = buildSampleTokens(guardianOverride);
  const [dexResult, birdeyePatches, solanaPatch] = await Promise.all([
    fetchDexScreenerPatches(baseTokens),
    fetchBirdeyePatches(),
    fetchSolanaRpcPatch(),
  ]);

  const mergedPatches: Record<string, TokenPatch> = { ...dexResult.patches };
  for (const [symbol, patch] of Object.entries(birdeyePatches)) {
    mergedPatches[symbol] = { ...mergedPatches[symbol], ...patch };
  }
  mergedPatches.HIVE = { ...mergedPatches.HIVE, ...solanaPatch };

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

function tokenFromDexPair(pair: DexPair, idHint: string): Token {
  const patch = patchFromDexPair(pair);
  const symbol = pair.baseToken?.symbol ?? "???";
  const name = pair.baseToken?.name ?? symbol;
  const mint = patch.mintAddress ?? idHint;

  return buildTokenFromPartial({
    id: mint.length > 20 ? mint : `${symbol.toLowerCase()}-dex`,
    symbol,
    name,
    priceUsd: patch.priceUsd ?? 0,
    change24hPct: patch.change24hPct ?? 0,
    volume24hUsd: patch.volume24hUsd,
    liquidityUsd: patch.liquidityUsd,
    marketCapUsd: patch.marketCapUsd,
    mintAddress: patch.mintAddress,
    logoUrl: patch.logoUrl,
  });
}

export async function lookupTokenByQuery(query: string, pool?: Token[]): Promise<Token | null> {
  const q = query.trim();
  if (!q) return null;

  const scanGuard = guardTokenScan(q);
  if (!scanGuard.allowed) return null;

  const apiGuard = guardApiFetch("dex-lookup");
  if (!apiGuard.allowed) return null;

  const upper = q.toUpperCase();
  if (pool?.length) {
    const inPool = pool.find(
      (t) =>
        t.id === q ||
        t.symbol.toUpperCase() === upper ||
        t.mintAddress?.toLowerCase() === q.toLowerCase(),
    );
    if (inPool) return inPool;
  }

  const looksLikeMint = q.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(q);
  if (looksLikeMint) {
    const pair = await fetchDexPairByAddress(q);
    if (pair) return tokenFromDexPair(pair, q);
  }

  const pair = await fetchDexPairBySearch(upper, q);
  if (pair) {
    const mint = pair.baseToken?.address ?? q;
    return tokenFromDexPair(pair, mint);
  }

  if (!pool) {
    const feed = await fetchMvpTokenFeed();
    return lookupTokenByQuery(q, feed.all);
  }

  return null;
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

function mockSolanaMovers(timeframe: MoverTimeframe): SolanaMoversResult {
  const now = Date.now();
  const scale =
    timeframe === "5m" ? 1 :
    timeframe === "24h" ? 2.4 :
    timeframe === "7d" ? 8 :
    timeframe === "30d" ? 18 :
    42;

  const gainers: TokenMover[] = [
    { id: "bonk-m", symbol: "BONK", name: "Bonk", mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", priceUsd: 0.000034, changePct: 4.82 * scale },
    { id: "wif-m", symbol: "WIF", name: "dogwifhat", mintAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", priceUsd: 2.41, changePct: 3.15 * scale },
    { id: "popcat-m", symbol: "POPCAT", name: "Popcat", mintAddress: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", priceUsd: 1.12, changePct: 2.44 * scale },
    { id: "mew-m", symbol: "MEW", name: "cat in a dogs world", mintAddress: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvVUB6kiqq9p6p", priceUsd: 0.0089, changePct: 1.98 * scale },
    { id: "syn-m", symbol: "SYN", name: "SyNexus", mintAddress: SYN_MINT, priceUsd: 0.00432, changePct: 1.21 * scale },
  ];
  const losers: TokenMover[] = [
    { id: "pepe-m", symbol: "PEPE", name: "Pepe", mintAddress: "pepe-mint", priceUsd: 0.0000107, changePct: -3.44 * scale },
    { id: "myro-m", symbol: "MYRO", name: "Myro", mintAddress: "myro-mint", priceUsd: 0.21, changePct: -2.87 * scale },
    { id: "slerf-m", symbol: "SLERF", name: "Slerf", mintAddress: "slerf-mint", priceUsd: 0.38, changePct: -2.11 * scale },
    { id: "bome-m", symbol: "BOME", name: "BOOK OF MEME", mintAddress: "bome-mint", priceUsd: 0.012, changePct: -1.76 * scale },
    { id: "jup-m", symbol: "JUP", name: "Jupiter", mintAddress: "jup-mint", priceUsd: 1.02, changePct: -0.92 * scale },
  ];
  return { timeframe, gainers, losers, source: "mock", updatedAt: now };
}

async function fetchDexBoostAddresses(): Promise<string[]> {
  const [topRes, latestRes] = await Promise.all([
    fetch("https://api.dexscreener.com/token-boosts/top/v1"),
    fetch("https://api.dexscreener.com/token-boosts/latest/v1"),
  ]);
  const top = topRes.ok ? ((await topRes.json()) as DexBoostEntry[]) : [];
  const latest = latestRes.ok ? ((await latestRes.json()) as DexBoostEntry[]) : [];
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
  const response = await fetch(
    `https://api.dexscreener.com/tokens/v1/solana/${addresses.join(",")}`,
  );
  if (!response.ok) return [];
  const data = (await response.json()) as DexPair[] | { pairs?: DexPair[] };
  if (Array.isArray(data)) return data;
  return data.pairs ?? [];
}

async function fetchDexMoverPool(): Promise<{ pairs: DexPair[]; source: FeedSource }> {
  const addresses = await fetchDexBoostAddresses();
  if (!addresses.length) throw new Error("No boosted Solana tokens");
  const pairs = await fetchDexPairsBatch(addresses);
  if (!pairs.length) throw new Error("DexScreener returned no pairs");
  return { pairs, source: "live" };
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
    const response = await fetch(`https://public-api.birdeye.so/defi/history_price?${params}`, {
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
  await Promise.all(
    candidates.map(async (base) => {
      const changePct = await fetchPeriodChangePct(base.mintAddress, config.seconds, config.type);
      if (changePct == null || !Number.isFinite(changePct)) return;
      movers.push({ ...base, changePct });
    }),
  );

  return movers;
}

export async function fetchSolanaTopMovers(timeframe: MoverTimeframe): Promise<SolanaMoversResult> {
  const cacheKey = `movers:${timeframe}`;
  const cached = readMoversCache<SolanaMoversResult>(cacheKey);
  if (cached) return cached;

  const apiGuard = guardApiFetch(`dex-movers-${timeframe}`);
  if (!apiGuard.allowed) {
    return writeMoversCache(cacheKey, mockSolanaMovers(timeframe), MOVER_CACHE_TTL_MS[timeframe]);
  }

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
        MOVER_CACHE_TTL_MS[timeframe],
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
    return writeMoversCache(cacheKey, mockSolanaMovers(timeframe), MOVER_CACHE_TTL_MS[timeframe]);
  }
}

export async function fetchSolanaMoversBoard(): Promise<SolanaMoversBoard> {
  const cached = readMoversCache<SolanaMoversBoard>("movers:board");
  if (cached) return cached;

  const slices = await Promise.all(MOVER_TIMEFRAMES.map((timeframe) => fetchSolanaTopMovers(timeframe)));
  const board = Object.fromEntries(slices.map((slice) => [slice.timeframe, slice])) as SolanaMoversBoard;
  writeMoversCache("movers:board", board, 60_000);
  return board;
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
