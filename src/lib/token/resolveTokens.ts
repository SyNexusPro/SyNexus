import type { Token } from "../../data/tokens";
import { noteProviderHealth } from "../synexus/eventBus";
import { matchPumpFun, type FormingCoin } from "./formingCoins";
import { tokenKey, type TokenSource, type UniversalToken } from "./universalToken";

const TIMEOUT_MS = 8_000;
const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[a-fA-F0-9]{40}$/;

export function isSolanaMint(value: string): boolean {
  return MINT.test(value.trim());
}

export function isAssetAddress(value: string): boolean {
  const q = value.trim();
  return isSolanaMint(q) || EVM.test(q);
}

type DexPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string | number;
  fdv?: number;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  baseToken?: { address?: string; name?: string; symbol?: string };
};

function num(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(provider: string, url: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      noteProviderHealth(provider, false, `HTTP ${response.status}`);
      throw new Error(`${provider} HTTP ${response.status}`);
    }
    noteProviderHealth(provider, true);
    return await response.json();
  } catch (error) {
    noteProviderHealth(provider, false, error instanceof Error ? error.message : "request failed");
    throw error;
  }
}

function fromPool(query: string, pool: Token[]): UniversalToken[] {
  const q = query.trim().toLowerCase();
  const upper = query.trim().toUpperCase();
  const now = Date.now();
  const hits: UniversalToken[] = [];
  for (const token of pool) {
    const mint = token.mintAddress?.trim();
    if (!mint) continue;
    const symbolHit = token.symbol.toUpperCase() === upper;
    const nameHit = token.name.toLowerCase().includes(q);
    const mintHit = mint.toLowerCase() === q;
    if (!symbolHit && !nameHit && !mintHit) continue;
    hits.push({
      chain: "solana",
      mint,
      pool: null,
      exchange: null,
      symbol: token.symbol,
      name: token.name,
      priceUsd: Number.isFinite(token.priceUsd) ? token.priceUsd : null,
      change24hPct: Number.isFinite(token.change24hPct) ? token.change24hPct : null,
      liquidityUsd: token.liquidityUsd ?? null,
      volume24hUsd: token.volume24hUsd ?? null,
      marketCapUsd: token.marketCapUsd ?? null,
      source: "synexus",
      sources: ["synexus"],
      fetchedAt: now,
      confidence: 0.45,
    });
  }
  return hits;
}

async function fromDex(query: string): Promise<UniversalToken[]> {
  const data = (await fetchJson(
    "dexscreener",
    `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`,
  )) as { pairs?: DexPair[] };
  const now = Date.now();
  const hits: UniversalToken[] = [];
  for (const pair of data.pairs ?? []) {
    const mint = pair.baseToken?.address?.trim();
    const chain = (pair.chainId || "").toLowerCase();
    if (!mint || !chain) continue;
    hits.push({
      chain,
      mint,
      pool: pair.pairAddress ?? null,
      exchange: pair.dexId ?? null,
      symbol: pair.baseToken?.symbol?.trim() || "???",
      name: pair.baseToken?.name?.trim() || pair.baseToken?.symbol?.trim() || "Unknown",
      priceUsd: num(pair.priceUsd),
      change24hPct: num(pair.priceChange?.h24),
      liquidityUsd: num(pair.liquidity?.usd),
      volume24hUsd: num(pair.volume?.h24),
      marketCapUsd: num(pair.fdv),
      source: "dexscreener",
      sources: ["dexscreener"],
      fetchedAt: now,
      confidence: 0.6,
    });
  }
  return hits;
}

async function fromGecko(query: string): Promise<UniversalToken[]> {
  const data = (await fetchJson(
    "geckoterminal",
    `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(query)}`,
  )) as {
    data?: Array<{
      attributes?: {
        address?: string;
        name?: string;
        base_token_price_usd?: string;
        reserve_in_usd?: string;
      };
      relationships?: {
        base_token?: { data?: { id?: string } };
        dex?: { data?: { id?: string } };
        network?: { data?: { id?: string } };
      };
    }>;
  };
  const now = Date.now();
  const hits: UniversalToken[] = [];
  for (const row of data.data ?? []) {
    const rawId = row.relationships?.base_token?.data?.id ?? "";
    const network = (row.relationships?.network?.data?.id || rawId.split("_")[0] || "").toLowerCase();
    const mint = rawId.includes("_") ? rawId.slice(rawId.indexOf("_") + 1) : "";
    if (!mint || !network) continue;
    const name = row.attributes?.name?.trim() || "Unknown";
    const symbol = name.split("/")[0]?.trim() || "???";
    hits.push({
      chain: network,
      mint,
      pool: row.attributes?.address ?? null,
      exchange: row.relationships?.dex?.data?.id ?? null,
      symbol,
      name,
      priceUsd: num(row.attributes?.base_token_price_usd),
      change24hPct: null,
      liquidityUsd: num(row.attributes?.reserve_in_usd),
      volume24hUsd: null,
      marketCapUsd: null,
      source: "geckoterminal",
      sources: ["geckoterminal"],
      fetchedAt: now,
      confidence: 0.55,
    });
  }
  return hits;
}

function fromForming(coins: FormingCoin[], source: TokenSource): UniversalToken[] {
  const now = Date.now();
  return coins.map((coin) => ({
    chain: coin.chain,
    mint: coin.mint,
    pool: coin.pool,
    exchange: coin.exchange,
    symbol: coin.symbol,
    name: coin.name,
    priceUsd: coin.priceUsd,
    change24hPct: null,
    liquidityUsd: coin.liquidityUsd,
    volume24hUsd: null,
    marketCapUsd: coin.marketCapUsd,
    source,
    sources: [source],
    fetchedAt: now,
    confidence: source === "pumpfun" ? 0.5 : 0.55,
  }));
}

async function fromDexAddress(address: string): Promise<UniversalToken[]> {
  const data = (await fetchJson(
    "dexscreener",
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`,
  )) as { pairs?: DexPair[] };
  const now = Date.now();
  const hits: UniversalToken[] = [];
  for (const pair of data.pairs ?? []) {
    const mint = pair.baseToken?.address?.trim();
    const chain = (pair.chainId || "").toLowerCase();
    if (!mint || !chain) continue;
    if (mint.toLowerCase() !== address.trim().toLowerCase()) continue;
    hits.push({
      chain,
      mint,
      pool: pair.pairAddress ?? null,
      exchange: pair.dexId ?? null,
      symbol: pair.baseToken?.symbol?.trim() || "???",
      name: pair.baseToken?.name?.trim() || pair.baseToken?.symbol?.trim() || "Unknown",
      priceUsd: num(pair.priceUsd),
      change24hPct: num(pair.priceChange?.h24),
      liquidityUsd: num(pair.liquidity?.usd),
      volume24hUsd: num(pair.volume?.h24),
      marketCapUsd: num(pair.fdv),
      source: "dexscreener",
      sources: ["dexscreener"],
      fetchedAt: now,
      confidence: 0.7,
    });
  }
  return hits;
}

async function fromRpc(mint: string): Promise<UniversalToken | null> {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined;
  if (!endpoint?.trim() || !isSolanaMint(mint)) return null;
  const data = (await fetchJson("solana-rpc", endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [mint, { encoding: "base64" }],
    }),
  })) as { result?: { value?: unknown } | null };
  if (!data.result?.value) return null;
  return {
    chain: "solana",
    mint,
    pool: null,
    exchange: null,
    symbol: "UNKNOWN",
    name: "Unindexed mint",
    priceUsd: null,
    change24hPct: null,
    liquidityUsd: null,
    volume24hUsd: null,
    marketCapUsd: null,
    source: "rpc",
    sources: ["rpc"],
    fetchedAt: Date.now(),
    confidence: 0.3,
  };
}

function prefer(
  current: number | null,
  next: number | null,
  nextSource: TokenSource,
  currentSources: TokenSource[],
): number | null {
  if (next == null) return current;
  if (current == null) return next;
  if (nextSource !== "synexus") return next;
  if (currentSources.every((source) => source === "synexus")) return next;
  return current;
}

function merge(rows: UniversalToken[]): UniversalToken[] {
  const byKey = new Map<string, UniversalToken>();
  for (const row of rows) {
    const key = tokenKey(row);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...row, sources: [...row.sources] });
      continue;
    }
    const sources = [...new Set([...prev.sources, ...row.sources])];
    const richerLiq = (row.liquidityUsd ?? -1) > (prev.liquidityUsd ?? -1);
    byKey.set(key, {
      ...prev,
      pool: richerLiq && row.pool ? row.pool : prev.pool ?? row.pool,
      exchange: richerLiq && row.exchange ? row.exchange : prev.exchange ?? row.exchange,
      symbol: prev.symbol === "UNKNOWN" ? row.symbol : prev.symbol,
      name: prev.name === "Unindexed mint" ? row.name : prev.name,
      priceUsd: prefer(prev.priceUsd, row.priceUsd, row.source, prev.sources),
      change24hPct: prefer(prev.change24hPct, row.change24hPct, row.source, prev.sources),
      liquidityUsd: prefer(prev.liquidityUsd, row.liquidityUsd, row.source, prev.sources),
      volume24hUsd: prefer(prev.volume24hUsd, row.volume24hUsd, row.source, prev.sources),
      marketCapUsd: prefer(prev.marketCapUsd, row.marketCapUsd, row.source, prev.sources),
      source: sources[0] ?? prev.source,
      sources,
      fetchedAt: Math.max(prev.fetchedAt, row.fetchedAt),
      confidence: Math.min(0.95, 0.35 + sources.length * 0.25),
    });
  }
  return [...byKey.values()];
}

function rank(rows: UniversalToken[], query: string): UniversalToken[] {
  const q = query.trim().toLowerCase();
  const upper = query.trim().toUpperCase();
  const mintQuery = isAssetAddress(query) ? query.trim().toLowerCase() : "";
  return [...rows].sort((a, b) => {
    const aMint = mintQuery && a.mint.toLowerCase() === mintQuery ? 1 : 0;
    const bMint = mintQuery && b.mint.toLowerCase() === mintQuery ? 1 : 0;
    if (aMint !== bMint) return bMint - aMint;
    const aSym = a.symbol.toUpperCase() === upper ? 1 : 0;
    const bSym = b.symbol.toUpperCase() === upper ? 1 : 0;
    if (aSym !== bSym) return bSym - aSym;
    const aName = a.name.toLowerCase().includes(q) ? 1 : 0;
    const bName = b.name.toLowerCase().includes(q) ? 1 : 0;
    if (aName !== bName) return bName - aName;
    return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
  });
}

async function settle<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

/**
 * Search the local catalog, DexScreener, GeckoTerminal, and pump.fun together.
 * Address lookups also hit DexScreener's token endpoint on every chain it indexes.
 * One failed source returns nothing from that source. The others still return.
 * Every distinct chain+mint is kept. Symbol ties are not collapsed.
 */
export async function resolveTokens(query: string, pool: Token[] = []): Promise<UniversalToken[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const tasks: Array<Promise<UniversalToken[]>> = [
    Promise.resolve(fromPool(q, pool)),
    settle(fromDex(q), []),
    settle(fromGecko(q), []),
    settle(matchPumpFun(q).then((rows) => fromForming(rows, "pumpfun")), []),
  ];
  if (isAssetAddress(q)) {
    tasks.push(settle(fromDexAddress(q), []));
  }
  if (isSolanaMint(q)) {
    tasks.push(settle(fromRpc(q).then((row) => (row ? [row] : [])), []));
  }

  const groups = await Promise.all(tasks);
  return rank(merge(groups.flat()), q);
}

export function formatResolvedTokens(tokens: UniversalToken[], limit = 6): string {
  if (!tokens.length) return "No token matched that query on the sources that responded.";
  return tokens
    .slice(0, limit)
    .map((token) => {
      const price = token.priceUsd == null ? "price unavailable" : `$${token.priceUsd}`;
      const liq = token.liquidityUsd == null ? "liquidity unavailable" : `liq $${Math.round(token.liquidityUsd)}`;
      return `${token.symbol} on ${token.chain} · mint ${token.mint} · ${token.exchange ?? "exchange unknown"} · pool ${token.pool ?? "none"} · ${price} · ${liq} · sources ${token.sources.join(", ")} · confidence ${token.confidence.toFixed(2)} · fetched ${new Date(token.fetchedAt).toISOString()}`;
    })
    .join("\n");
}
