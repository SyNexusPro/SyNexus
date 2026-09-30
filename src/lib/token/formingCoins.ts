import { emitSynexusEvent, noteProviderHealth } from "../synexus/eventBus";

/**
 * Newest public coins. One failed feed returns nothing from that feed.
 * This is the live slice those feeds just returned, not a stored list of every coin.
 */
export type FormingCoin = {
  chain: string;
  mint: string;
  symbol: string;
  name: string;
  platform: string;
  exchange: string | null;
  pool: string | null;
  createdAt: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
};

const TIMEOUT_MS = 8_000;

/** Networks GeckoTerminal publishes new pools for. A missing network does not cancel the others. */
const GECKO_NETWORKS = [
  "solana",
  "eth",
  "base",
  "bsc",
  "arbitrum",
  "polygon_pos",
  "avax",
  "optimism",
  "sui-network",
  "ton",
  "hyperliquid",
  "scroll",
  "linea",
  "blast",
  "world-chain",
  "cronos",
] as const;

const seen = new Set<string>();

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asMs(value: unknown): number | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}

async function fetchJson(provider: string, url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
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

async function fetchQuiet(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function settle<T>(task: Promise<T[]>): Promise<T[]> {
  try {
    return await task;
  } catch {
    return [];
  }
}

async function fromPump(): Promise<FormingCoin[]> {
  const rows = (await fetchJson(
    "pumpfun",
    "https://frontend-api-v3.pump.fun/coins?offset=0&limit=48&sort=created_timestamp&order=DESC&includeNsfw=false",
  )) as Array<{
    mint?: string;
    name?: string;
    symbol?: string;
    created_timestamp?: number;
    complete?: boolean;
    usd_market_cap?: number;
    bonding_curve?: string;
  }>;
  if (!Array.isArray(rows)) return [];
  const coins: FormingCoin[] = [];
  for (const row of rows) {
    const mint = row.mint?.trim();
    if (!mint) continue;
    coins.push({
      chain: "solana",
      mint,
      symbol: (row.symbol || "").trim() || "NEW",
      name: (row.name || "").trim() || (row.symbol || "").trim() || "Unnamed",
      platform: "pump.fun",
      exchange: row.complete ? "pump.fun graduated" : "pump.fun bonding curve",
      pool: row.bonding_curve?.trim() || null,
      createdAt: asMs(row.created_timestamp),
      priceUsd: null,
      liquidityUsd: null,
      marketCapUsd: num(row.usd_market_cap),
    });
  }
  return coins;
}

type GeckoPool = {
  attributes?: {
    address?: string;
    name?: string;
    pool_created_at?: string;
    base_token_price_usd?: string;
    reserve_in_usd?: string;
  };
  relationships?: {
    dex?: { data?: { id?: string } };
    base_token?: { data?: { id?: string } };
    network?: { data?: { id?: string } };
  };
};

function fromGeckoPayload(rows: GeckoPool[], fallbackNetwork: string | null): FormingCoin[] {
  const coins: FormingCoin[] = [];
  for (const row of rows) {
    const tokenId = row.relationships?.base_token?.data?.id || "";
    const split = tokenId.indexOf("_");
    const fromId = split > 0 ? tokenId.slice(0, split).toLowerCase() : "";
    const network = (row.relationships?.network?.data?.id || fromId || fallbackNetwork || "").toLowerCase();
    const mint = split > 0 ? tokenId.slice(split + 1).trim() : "";
    if (!mint || !network) continue;
    const name = row.attributes?.name?.trim() || "New pool";
    coins.push({
      chain: network,
      mint,
      symbol: name.split("/")[0]?.trim() || "NEW",
      name,
      platform: "geckoterminal",
      exchange: row.relationships?.dex?.data?.id ?? null,
      pool: row.attributes?.address ?? null,
      createdAt: asMs(row.attributes?.pool_created_at),
      priceUsd: num(row.attributes?.base_token_price_usd),
      liquidityUsd: num(row.attributes?.reserve_in_usd),
      marketCapUsd: null,
    });
  }
  return coins;
}

async function fromGecko(url: string, fallbackNetwork: string | null, quiet = false): Promise<FormingCoin[]> {
  const json = (await (quiet ? fetchQuiet(url) : fetchJson("geckoterminal", url))) as { data?: GeckoPool[] };
  return fromGeckoPayload(json.data || [], fallbackNetwork);
}

async function fromDexProfiles(): Promise<FormingCoin[]> {
  const rows = (await fetchJson("dexscreener", "https://api.dexscreener.com/token-profiles/latest/v1")) as Array<{
    chainId?: string;
    tokenAddress?: string;
    description?: string;
    claimDate?: string;
  }>;
  if (!Array.isArray(rows)) return [];
  const coins: FormingCoin[] = [];
  for (const row of rows) {
    const chain = (row.chainId || "").trim().toLowerCase();
    const mint = row.tokenAddress?.trim();
    if (!chain || !mint) continue;
    const description = (row.description || "").trim();
    coins.push({
      chain,
      mint,
      symbol: "NEW",
      name: description.slice(0, 80) || "New token profile",
      platform: "dexscreener",
      exchange: null,
      pool: null,
      createdAt: asMs(row.claimDate),
      priceUsd: null,
      liquidityUsd: null,
      marketCapUsd: null,
    });
  }
  return coins;
}

function dedupe(rows: FormingCoin[]): FormingCoin[] {
  const byKey = new Map<string, FormingCoin>();
  for (const row of rows) {
    const key = `${row.chain}:${row.mint}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    const prevCreated = prev.createdAt ?? 0;
    const nextCreated = row.createdAt ?? 0;
    if (nextCreated > prevCreated) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

function noteNew(coins: FormingCoin[]): void {
  let noted = 0;
  for (const coin of coins) {
    const key = `${coin.chain}:${coin.mint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (noted >= 12) continue;
    noted += 1;
    const age = coin.createdAt == null ? "age unavailable" : new Date(coin.createdAt).toISOString();
    emitSynexusEvent({
      name: "TOKEN_DISCOVERED",
      at: Date.now(),
      source: coin.platform,
      mint: coin.mint,
      detail: `${coin.symbol} on ${coin.chain} via ${coin.platform}. mint ${coin.mint}. created ${age}.`,
    });
    if (coin.pool) {
      emitSynexusEvent({
        name: "NEW_POOL",
        at: Date.now(),
        source: coin.platform,
        mint: coin.mint,
        detail: `${coin.symbol} pool ${coin.pool} on ${coin.chain}${coin.exchange ? ` · ${coin.exchange}` : ""}.`,
      });
    }
  }
}

export async function fetchFormingCoins(): Promise<FormingCoin[]> {
  const tasks: Array<Promise<FormingCoin[]>> = [
    settle(fromPump()),
    settle(fromGecko("https://api.geckoterminal.com/api/v2/networks/new_pools?page=1", null)),
    settle(fromDexProfiles()),
    ...GECKO_NETWORKS.map((network) =>
      settle(fromGecko(`https://api.geckoterminal.com/api/v2/networks/${network}/new_pools?page=1`, network, true)),
    ),
  ];
  const coins = dedupe((await Promise.all(tasks)).flat());
  noteNew(coins);
  return coins;
}

/** Coins still on pump.fun whose symbol, name, or mint matches. Newest window only. */
export async function matchPumpFun(query: string): Promise<FormingCoin[]> {
  return searchForming(await fromPump(), query);
}

export function searchForming(coins: FormingCoin[], query: string): FormingCoin[] {
  const q = query.trim().toLowerCase();
  const upper = query.trim().toUpperCase();
  if (q.length < 2) return [];
  return coins.filter((coin) => {
    if (coin.mint.toLowerCase() === q) return true;
    if (coin.symbol.toUpperCase() === upper) return true;
    return coin.name.toLowerCase().includes(q);
  });
}

function ageLabel(createdAt: number | null): string {
  if (createdAt == null) return "age unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - createdAt) / 60_000));
  if (minutes <= 1) return "just now";
  if (minutes < 60) return `${minutes}m old`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h old`;
  return `${Math.round(hours / 24)}d old`;
}

function money(value: number | null, label: string): string {
  return value == null ? `${label} unavailable` : `${label} $${Math.round(value)}`;
}

/** Newest rows from each platform, so one busy chain does not hide the others. */
export function formatFormingCoins(coins: FormingCoin[]): string {
  const fetchedAt = new Date().toISOString();
  if (!coins.length) {
    return [
      `PUBLIC FORMING FEEDS fetched at ${fetchedAt}.`,
      "No new coins came back from pump.fun, GeckoTerminal, or DexScreener.",
      "Do not invent coins, mints, or prices.",
    ].join("\n");
  }
  const counts = new Map<string, number>();
  const picked: FormingCoin[] = [];
  for (const coin of coins) {
    const key = coin.platform === "pump.fun" ? coin.platform : `${coin.platform}:${coin.chain}`;
    const limit = coin.platform === "pump.fun" ? 8 : 2;
    const n = counts.get(key) ?? 0;
    if (n >= limit) continue;
    counts.set(key, n + 1);
    picked.push(coin);
    if (picked.length >= 36) break;
  }
  const chains = new Set(coins.map((coin) => coin.chain));
  const platforms = new Set(coins.map((coin) => coin.platform));
  const lines = picked.map((coin) => {
    const price = coin.priceUsd == null ? "price unavailable" : `$${coin.priceUsd}`;
    return `${coin.symbol} · ${coin.name} · ${coin.chain} · ${coin.platform}${coin.exchange ? ` · ${coin.exchange}` : ""} · mint ${coin.mint} · ${ageLabel(coin.createdAt)} · ${price} · ${money(coin.liquidityUsd, "liq")} · ${money(coin.marketCapUsd, "mcap")}`;
  });
  return [
    `PUBLIC FORMING FEEDS fetched at ${fetchedAt}.`,
    `Returned ${coins.length} distinct coins across ${chains.size} chains and ${platforms.size} platforms (pump.fun bonding curve, GeckoTerminal new pools, DexScreener latest profiles).`,
    "This is the newest public slice, not a stored copy of every coin. If a coin is not listed, that feed did not return it. Do not invent the rest.",
    ...lines,
  ].join("\n");
}
