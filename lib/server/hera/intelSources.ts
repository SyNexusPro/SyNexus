import { pairsFromDexPayload, type DexPair } from "../market/dexscreener.js";
import type { HeraIntelEnv } from "./partnerAuth.js";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export type MarketSourceName = "DexScreener" | "GeckoTerminal";

export type MarketSourceResult = {
  name: MarketSourceName;
  status: "match" | "no_pair" | "failed";
};

export type MarketReading = {
  status: "available" | "not_indexed" | "unavailable";
  source: MarketSourceName | null;
  sources: MarketSourceResult[];
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  priceChange5mPct: number | null;
  priceChange1hPct: number | null;
  priceChange24hPct: number | null;
  buys24h: number | null;
  sells24h: number | null;
  pairUrl: string | null;
  dexId: string | null;
  pairCreatedAtMs: number | null;
  boostActive: number | null;
  socialLinkCount: number | null;
};

export type SecurityReading = {
  status: "measured" | "not_found" | "not_a_mint" | "uninitialized" | "unavailable" | "not_configured";
  program: "spl-token" | "token-2022" | null;
  decimals: number | null;
  supply: string | null;
  mintAuthorityActive: boolean | null;
  freezeAuthorityActive: boolean | null;
};

type FetchLike = typeof fetch;

export function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function blankMarket(status: "not_indexed" | "unavailable", sources: MarketSourceResult[]): MarketReading {
  return {
    status,
    source: null,
    sources,
    symbol: null,
    name: null,
    priceUsd: null,
    liquidityUsd: null,
    volume24hUsd: null,
    marketCapUsd: null,
    fdvUsd: null,
    priceChange5mPct: null,
    priceChange1hPct: null,
    priceChange24hPct: null,
    buys24h: null,
    sells24h: null,
    pairUrl: null,
    dexId: null,
    pairCreatedAtMs: null,
    boostActive: null,
    socialLinkCount: null,
  };
}

export function blankSecurity(status: SecurityReading["status"]): SecurityReading {
  return {
    status,
    program: null,
    decimals: null,
    supply: null,
    mintAuthorityActive: null,
    freezeAuthorityActive: null,
  };
}

function cleanSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim();
  if (!symbol || symbol.length > 32 || !/^[A-Za-z0-9._$-]+$/.test(symbol)) return null;
  return symbol;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name) return null;
  return name.slice(0, 80);
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanDexId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) return null;
  return id;
}

function pairCreatedAtMs(value: unknown): number | null {
  const n = finiteNumber(value);
  if (n == null || n < 1_000_000_000_000) return null;
  return n;
}

function liquidityOf(pair: DexPair): number | null {
  return finiteNumber(pair.liquidity?.usd);
}

export function marketFromDexPayload(mint: string, payload: unknown): MarketReading | null {
  const matches = pairsFromDexPayload(payload).filter((pair) => {
    if ((pair.chainId || "").toLowerCase() !== "solana") return false;
    return pair.baseToken?.address === mint;
  });
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const left = liquidityOf(a);
    const right = liquidityOf(b);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right - left;
  });
  const pair = matches[0]!;
  const info = pair.info;
  const socialLinkCount =
    info && typeof info === "object" && Array.isArray(info.socials) ? info.socials.length : null;
  const boostActive =
    pair.boosts && typeof pair.boosts === "object" && "active" in pair.boosts
      ? finiteNumber(pair.boosts.active)
      : null;
  return {
    status: "available",
    source: "DexScreener",
    sources: [{ name: "DexScreener", status: "match" }],
    symbol: cleanSymbol(pair.baseToken?.symbol),
    name: cleanName(pair.baseToken?.name),
    priceUsd: finiteNumber(pair.priceUsd),
    liquidityUsd: liquidityOf(pair),
    volume24hUsd: finiteNumber(pair.volume?.h24),
    marketCapUsd: finiteNumber(pair.marketCap),
    fdvUsd: finiteNumber(pair.fdv),
    priceChange5mPct: finiteNumber(pair.priceChange?.m5),
    priceChange1hPct: finiteNumber(pair.priceChange?.h1),
    priceChange24hPct: finiteNumber(pair.priceChange?.h24),
    buys24h: finiteNumber(pair.txns?.h24?.buys),
    sells24h: finiteNumber(pair.txns?.h24?.sells),
    pairUrl: httpsUrl(pair.url),
    dexId: cleanDexId(pair.dexId),
    pairCreatedAtMs: pairCreatedAtMs(pair.pairCreatedAt),
    boostActive,
    socialLinkCount,
  };
}

type GeckoPool = {
  attributes?: {
    address?: string;
    name?: string;
    token_price_usd?: string;
    fdv_usd?: string;
    reserve_in_usd?: string;
    volume_usd?: { h24?: string };
    price_change_percentage?: { m5?: string; h1?: string; h24?: string };
    transactions?: { h24?: { buys?: number; sells?: number } };
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
};

function geckoMatchesMint(pool: GeckoPool, mint: string): boolean {
  const id = pool.relationships?.base_token?.data?.id;
  if (!id) return true;
  return id === mint || id.endsWith(`_${mint}`) || id.endsWith(`:${mint}`);
}

export function marketFromGeckoPayload(mint: string, payload: unknown): MarketReading | null {
  const pools = payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
    ? ((payload as { data: GeckoPool[] }).data)
    : [];
  const matches = pools.filter((pool) => geckoMatchesMint(pool, mint) && pool.attributes?.address);
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const left = finiteNumber(a.attributes?.reserve_in_usd);
    const right = finiteNumber(b.attributes?.reserve_in_usd);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right - left;
  });
  const pool = matches[0]!;
  const attributes = pool.attributes ?? {};
  const name = cleanName(attributes.name);
  const symbolFromName = name?.includes(" / ") ? cleanSymbol(name.split(" / ")[0]) : null;
  return {
    status: "available",
    source: "GeckoTerminal",
    sources: [{ name: "GeckoTerminal", status: "match" }],
    symbol: symbolFromName,
    name,
    priceUsd: finiteNumber(attributes.token_price_usd),
    liquidityUsd: finiteNumber(attributes.reserve_in_usd),
    volume24hUsd: finiteNumber(attributes.volume_usd?.h24),
    marketCapUsd: null,
    fdvUsd: finiteNumber(attributes.fdv_usd),
    priceChange5mPct: finiteNumber(attributes.price_change_percentage?.m5),
    priceChange1hPct: finiteNumber(attributes.price_change_percentage?.h1),
    priceChange24hPct: finiteNumber(attributes.price_change_percentage?.h24),
    buys24h: finiteNumber(attributes.transactions?.h24?.buys),
    sells24h: finiteNumber(attributes.transactions?.h24?.sells),
    pairUrl: attributes.address ? httpsUrl(`https://www.geckoterminal.com/solana/pools/${attributes.address}`) : null,
    dexId: cleanDexId(pool.relationships?.dex?.data?.id),
    pairCreatedAtMs: null,
    boostActive: null,
    socialLinkCount: null,
  };
}

async function readJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadMarketReading(mint: string, fetchImpl: FetchLike = fetch): Promise<MarketReading> {
  const sources: MarketSourceResult[] = [];
  try {
    const response = await fetchImpl(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const payload = response.ok ? await readJson(response) : null;
    if (!response.ok || payload == null) {
      sources.push({ name: "DexScreener", status: "failed" });
    } else {
      const match = marketFromDexPayload(mint, payload);
      if (match) return { ...match, sources: [...sources, { name: "DexScreener", status: "match" }] };
      sources.push({ name: "DexScreener", status: "no_pair" });
    }
  } catch {
    sources.push({ name: "DexScreener", status: "failed" });
  }

  try {
    const response = await fetchImpl(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}/pools?page=1`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) },
    );
    const payload = response.ok ? await readJson(response) : null;
    if (!response.ok || payload == null) {
      sources.push({ name: "GeckoTerminal", status: "failed" });
    } else {
      const match = marketFromGeckoPayload(mint, payload);
      if (match) return { ...match, sources: [...sources, { name: "GeckoTerminal", status: "match" }] };
      sources.push({ name: "GeckoTerminal", status: "no_pair" });
    }
  } catch {
    sources.push({ name: "GeckoTerminal", status: "failed" });
  }

  if (sources.some((source) => source.status === "no_pair")) return blankMarket("not_indexed", sources);
  return blankMarket("unavailable", sources);
}

export function solanaRpcEndpoint(env: HeraIntelEnv): string | null {
  const preferred = typeof env.SOLANA_RPC_URL === "string" ? env.SOLANA_RPC_URL.trim() : "";
  const fallback = typeof env.VITE_SOLANA_RPC_URL === "string" ? env.VITE_SOLANA_RPC_URL.trim() : "";
  const raw = preferred || fallback;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function programFromOwner(owner: unknown): SecurityReading["program"] {
  if (owner === TOKEN_PROGRAM) return "spl-token";
  if (owner === TOKEN_2022_PROGRAM) return "token-2022";
  return null;
}

function authorityFlag(info: Record<string, unknown>, key: "mintAuthority" | "freezeAuthority"): boolean | null {
  if (!Object.prototype.hasOwnProperty.call(info, key)) return null;
  const value = info[key];
  if (value == null) return false;
  if (typeof value === "string" && value.trim()) return true;
  return null;
}

function decimalsOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 255) return null;
  return value;
}

function supplyOf(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  return value;
}

export function readSplMintBytes(data: Buffer): {
  decimals: number;
  supply: string;
  isInitialized: boolean;
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
} | null {
  if (data.length < 82) return null;
  const mintOption = data.readUInt32LE(0);
  const freezeOption = data.readUInt32LE(46);
  if ((mintOption !== 0 && mintOption !== 1) || (freezeOption !== 0 && freezeOption !== 1)) return null;
  return {
    decimals: data.readUInt8(44),
    supply: data.readBigUInt64LE(36).toString(),
    isInitialized: data.readUInt8(45) === 1,
    mintAuthorityActive: mintOption === 1,
    freezeAuthorityActive: freezeOption === 1,
  };
}

export function interpretMintAccount(value: unknown): SecurityReading {
  if (value == null) return blankSecurity("not_found");
  if (typeof value !== "object") return blankSecurity("unavailable");
  const account = value as { owner?: unknown; data?: unknown };
  const program = programFromOwner(account.owner);
  if (!program) return blankSecurity("not_a_mint");

  const data = account.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const parsed = (data as { parsed?: { type?: unknown; info?: unknown } }).parsed;
    if (parsed?.type !== "mint" || !parsed.info || typeof parsed.info !== "object") {
      return { ...blankSecurity("not_a_mint"), program };
    }
    const info = parsed.info as Record<string, unknown>;
    const reading: SecurityReading = {
      status: info.isInitialized === false ? "uninitialized" : "measured",
      program,
      decimals: decimalsOf(info.decimals),
      supply: supplyOf(info.supply),
      mintAuthorityActive: authorityFlag(info, "mintAuthority"),
      freezeAuthorityActive: authorityFlag(info, "freezeAuthority"),
    };
    return reading;
  }

  if (Array.isArray(data) && typeof data[0] === "string") {
    const decoded = readSplMintBytes(Buffer.from(data[0], "base64"));
    if (!decoded) return { ...blankSecurity("not_a_mint"), program };
    return {
      status: decoded.isInitialized ? "measured" : "uninitialized",
      program,
      decimals: decoded.decimals,
      supply: decoded.supply,
      mintAuthorityActive: decoded.mintAuthorityActive,
      freezeAuthorityActive: decoded.freezeAuthorityActive,
    };
  }

  return { ...blankSecurity("not_a_mint"), program };
}

export async function loadSecurityReading(
  mint: string,
  env: HeraIntelEnv,
  fetchImpl: FetchLike = fetch,
): Promise<SecurityReading> {
  const endpoint = solanaRpcEndpoint(env);
  if (!endpoint) return blankSecurity("not_configured");
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed" }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return blankSecurity("unavailable");
    const payload = (await readJson(response)) as { error?: unknown; result?: { value?: unknown } } | null;
    if (!payload || payload.error || !payload.result || !("value" in payload.result)) {
      return blankSecurity("unavailable");
    }
    return interpretMintAccount(payload.result.value);
  } catch {
    return blankSecurity("unavailable");
  }
}
