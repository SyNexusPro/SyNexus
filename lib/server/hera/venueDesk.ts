/**
 * Public last prices from major venues. No keys, no orders, no invented numbers.
 * A venue that does not answer is marked unavailable.
 */

export type VenueQuote = {
  venue: string;
  pair: string;
  priceUsd: number | null;
  change24hPct: number | null;
  note?: string;
};

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 6_000;
const CACHE_MS = 90_000;

let cache: { at: number; brief: string } | null = null;

export function resetVenueDeskCache(): void {
  cache = null;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function changeFromOpen(last: number | null, open: number | null): number | null {
  if (last === null || open === null || open === 0) return null;
  return ((last - open) / open) * 100;
}

export function quoteFromCoinbase(pair: string, stats: unknown): VenueQuote {
  const row = stats && typeof stats === "object" ? (stats as Record<string, unknown>) : {};
  const last = num(row.last);
  const open = num(row.open);
  return { venue: "Coinbase", pair, priceUsd: last, change24hPct: changeFromOpen(last, open) };
}

export function quotesFromBinance(payload: unknown): VenueQuote[] {
  const rows = Array.isArray(payload) ? payload : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as Record<string, unknown>;
    const pair = typeof rec.symbol === "string" ? rec.symbol : "";
    if (!pair) return [];
    return [{ venue: "Binance", pair, priceUsd: num(rec.lastPrice), change24hPct: num(rec.priceChangePercent) }];
  });
}

export function quotesFromKraken(payload: unknown): VenueQuote[] {
  const result = payload && typeof payload === "object" ? (payload as { result?: Record<string, unknown> }).result : undefined;
  if (!result) return [];
  const names: Record<string, string> = { XXBTZUSD: "BTC-USD", XETHZUSD: "ETH-USD", SOLUSD: "SOL-USD" };
  return Object.entries(result).flatMap(([key, row]) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as { c?: unknown[]; o?: unknown };
    const last = num(Array.isArray(rec.c) ? rec.c[0] : null);
    const open = num(rec.o);
    return [{ venue: "Kraken", pair: names[key] ?? key, priceUsd: last, change24hPct: changeFromOpen(last, open) }];
  });
}

export function quoteFromOkx(pair: string, payload: unknown): VenueQuote {
  const data = payload && typeof payload === "object" ? (payload as { data?: unknown[] }).data : undefined;
  const row = Array.isArray(data) && data[0] && typeof data[0] === "object" ? (data[0] as Record<string, unknown>) : {};
  const last = num(row.last);
  const open = num(row.open24h);
  return { venue: "OKX", pair, priceUsd: last, change24hPct: changeFromOpen(last, open) };
}

export function quoteFromBybit(pair: string, payload: unknown): VenueQuote {
  const list = payload && typeof payload === "object"
    ? (payload as { result?: { list?: unknown[] } }).result?.list
    : undefined;
  const row = Array.isArray(list) && list[0] && typeof list[0] === "object" ? (list[0] as Record<string, unknown>) : {};
  const last = num(row.lastPrice);
  const frac = num(row.price24hPcnt);
  return { venue: "Bybit", pair, priceUsd: last, change24hPct: frac === null ? null : frac * 100 };
}

export function quoteFromGemini(pair: string, payload: unknown): VenueQuote {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return { venue: "Gemini", pair, priceUsd: num(row.last), change24hPct: null, note: "24h change not provided" };
}

export function quoteFromKucoin(pair: string, payload: unknown): VenueQuote {
  const row = payload && typeof payload === "object" ? (payload as { data?: Record<string, unknown> }).data ?? {} : {};
  const last = num(row.last);
  const rate = num(row.changeRate);
  return { venue: "KuCoin", pair, priceUsd: last, change24hPct: rate === null ? null : rate * 100 };
}

export function quoteFromBitstamp(pair: string, payload: unknown): VenueQuote {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const last = num(row.last);
  const open = num(row.open);
  return { venue: "Bitstamp", pair, priceUsd: last, change24hPct: changeFromOpen(last, open) };
}

export function quotesFromCoinGecko(payload: unknown): VenueQuote[] {
  const row = payload && typeof payload === "object" ? (payload as Record<string, { usd?: unknown; usd_24h_change?: unknown }>) : {};
  const names: Record<string, string> = { bitcoin: "BTC-USD", ethereum: "ETH-USD", solana: "SOL-USD" };
  return Object.entries(names).map(([id, pair]) => ({
    venue: "CoinGecko",
    pair,
    priceUsd: num(row[id]?.usd),
    change24hPct: num(row[id]?.usd_24h_change),
  }));
}

function money(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function formatVenueDesk(asOfIso: string, quotes: VenueQuote[]): string {
  const lines = quotes.map((q) => {
    if (q.priceUsd === null) return `- ${q.venue} ${q.pair}: unavailable${q.note ? ` (${q.note})` : ""}`;
    const change = q.change24hPct === null ? "24h change not provided" : `24h ${q.change24hPct >= 0 ? "+" : ""}${q.change24hPct.toFixed(2)}%`;
    return `- ${q.venue} ${q.pair}: $${money(q.priceUsd)} (${change})`;
  });
  return [
    `VENUE DESK as of ${asOfIso}. Public last prices only. A line marked unavailable was not read — do not invent it.`,
    "These quotes are not orders, not a buy signal, and not a safety clearance.",
    ...lines,
  ].join("\n");
}

export function needsVenueDesk(message: string, intentHint?: string | null): boolean {
  if (
    intentHint === "market_movers" ||
    intentHint === "trade_decision" ||
    intentHint === "token_lookup" ||
    intentHint === "comparison" ||
    intentHint === "strategy"
  ) {
    return true;
  }
  const text = message.toLowerCase();
  if (/\balexu?s\b/.test(text)) return true;
  const asset = /\b(btc|bitcoin|eth|ethereum|sol|solana|coinbase|binance|kraken|okx|bybit|gemini|kucoin|bitstamp|coingecko|crypto)\b/.test(text);
  const ask = /\b(price|prices|market|markets|trading|quote|quotes|moving|chart|today|now|how's|how is|what is|what's)\b/.test(text);
  return asset && ask;
}

async function getJson(fetchImpl: FetchImpl, url: string): Promise<unknown> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function missed(venue: string, pair: string, err: unknown): VenueQuote {
  const note = err instanceof Error ? err.message : "error";
  return { venue, pair, priceUsd: null, change24hPct: null, note: note.slice(0, 40) };
}

export async function fetchVenueDesk(fetchImpl: FetchImpl = fetch): Promise<{ asOfIso: string; quotes: VenueQuote[]; brief: string }> {
  const jobs: Array<Promise<VenueQuote[]>> = [
    getJson(fetchImpl, "https://api.exchange.coinbase.com/products/BTC-USD/stats").then((j) => [quoteFromCoinbase("BTC-USD", j)]).catch((e) => [missed("Coinbase", "BTC-USD", e)]),
    getJson(fetchImpl, "https://api.exchange.coinbase.com/products/ETH-USD/stats").then((j) => [quoteFromCoinbase("ETH-USD", j)]).catch((e) => [missed("Coinbase", "ETH-USD", e)]),
    getJson(fetchImpl, "https://api.exchange.coinbase.com/products/SOL-USD/stats").then((j) => [quoteFromCoinbase("SOL-USD", j)]).catch((e) => [missed("Coinbase", "SOL-USD", e)]),
    getJson(fetchImpl, "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D")
      .then((j) => quotesFromBinance(j))
      .catch(() => getJson(fetchImpl, "https://api.binance.us/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D").then((j) => quotesFromBinance(j)))
      .catch((e) => [missed("Binance", "BTC/ETH/SOL", e)]),
    getJson(fetchImpl, "https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD")
      .then((j) => quotesFromKraken(j)).catch((e) => [missed("Kraken", "BTC/ETH/SOL", e)]),
    getJson(fetchImpl, "https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT").then((j) => [quoteFromOkx("BTC-USDT", j)]).catch((e) => [missed("OKX", "BTC-USDT", e)]),
    getJson(fetchImpl, "https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT").then((j) => [quoteFromOkx("ETH-USDT", j)]).catch((e) => [missed("OKX", "ETH-USDT", e)]),
    getJson(fetchImpl, "https://www.okx.com/api/v5/market/ticker?instId=SOL-USDT").then((j) => [quoteFromOkx("SOL-USDT", j)]).catch((e) => [missed("OKX", "SOL-USDT", e)]),
    getJson(fetchImpl, "https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT")
      .then((j) => [quoteFromBybit("BTCUSDT", j)])
      .catch(() => getJson(fetchImpl, "https://api.bytick.com/v5/market/tickers?category=spot&symbol=BTCUSDT").then((j) => [quoteFromBybit("BTCUSDT", j)]))
      .catch((e) => [missed("Bybit", "BTCUSDT", e)]),
    getJson(fetchImpl, "https://api.gemini.com/v1/pubticker/btcusd").then((j) => [quoteFromGemini("BTCUSD", j)]).catch((e) => [missed("Gemini", "BTCUSD", e)]),
    getJson(fetchImpl, "https://api.kucoin.com/api/v1/market/stats?symbol=BTC-USDT").then((j) => [quoteFromKucoin("BTC-USDT", j)]).catch((e) => [missed("KuCoin", "BTC-USDT", e)]),
    getJson(fetchImpl, "https://www.bitstamp.net/api/v2/ticker/btcusd/").then((j) => [quoteFromBitstamp("BTCUSD", j)]).catch((e) => [missed("Bitstamp", "BTCUSD", e)]),
    getJson(fetchImpl, "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true")
      .then((j) => quotesFromCoinGecko(j)).catch((e) => [missed("CoinGecko", "BTC/ETH/SOL", e)]),
  ];
  const quotes = (await Promise.all(jobs)).flat();
  const asOfIso = new Date().toISOString();
  return { asOfIso, quotes, brief: formatVenueDesk(asOfIso, quotes) };
}

export async function fetchVenueDeskBrief(fetchImpl: FetchImpl = fetch): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.brief;
  const desk = await fetchVenueDesk(fetchImpl);
  cache = { at: Date.now(), brief: desk.brief };
  return desk.brief;
}
