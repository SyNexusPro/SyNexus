export type MarketQuote = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePct?: number;
  kind: "crypto" | "stock" | "forex";
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h?: number;
};

/** Top crypto markets (USD) from CoinGecko public API. */
export async function fetchGlobalCryptoMarkets(limit = 20): Promise<MarketQuote[]> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`,
  );
  if (!response.ok) throw new Error("Crypto markets unavailable.");
  const rows = (await response.json()) as CoinGeckoMarket[];
  return rows.map((row) => ({
    id: row.id,
    symbol: row.symbol.toUpperCase(),
    name: row.name,
    price: row.current_price,
    changePct: row.price_change_percentage_24h,
    kind: "crypto" as const,
  }));
}

/** Major FX pairs vs USD via Frankfurter (ECB). */
export async function fetchForexMarkets(): Promise<MarketQuote[]> {
  const response = await fetch("https://api.frankfurter.app/latest?from=USD");
  if (!response.ok) throw new Error("Forex markets unavailable.");
  const json = (await response.json()) as { rates?: Record<string, number> };
  const rates = json.rates ?? {};
  const wanted = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "MXN"];
  return wanted
    .filter((code) => typeof rates[code] === "number")
    .map((code) => ({
      id: `usd-${code.toLowerCase()}`,
      symbol: `USD/${code}`,
      name: `US Dollar → ${code}`,
      price: rates[code],
      kind: "forex" as const,
    }));
}

/**
 * Stock board: Yahoo chart endpoints are CORS-blocked in many browsers,
 * so we serve a curated mega-cap board and enrich when a proxy/key exists later.
 * Prices refresh from a public Stooq CSV mirror when available.
 */
export async function fetchStockMarkets(): Promise<MarketQuote[]> {
  const tickers: Array<{ id: string; symbol: string; name: string; stooq: string }> = [
    { id: "aapl", symbol: "AAPL", name: "Apple", stooq: "aapl.us" },
    { id: "msft", symbol: "MSFT", name: "Microsoft", stooq: "msft.us" },
    { id: "nvda", symbol: "NVDA", name: "NVIDIA", stooq: "nvda.us" },
    { id: "amzn", symbol: "AMZN", name: "Amazon", stooq: "amzn.us" },
    { id: "googl", symbol: "GOOGL", name: "Alphabet", stooq: "googl.us" },
    { id: "meta", symbol: "META", name: "Meta", stooq: "meta.us" },
    { id: "tsla", symbol: "TSLA", name: "Tesla", stooq: "tsla.us" },
    { id: "spy", symbol: "SPY", name: "S&P 500 ETF", stooq: "spy.us" },
  ];

  const results = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const response = await fetch(
          `https://stooq.com/q/l/?s=${ticker.stooq}&f=sd2t2ohlcv&h&e=csv`,
        );
        if (!response.ok) throw new Error("stooq fail");
        const text = await response.text();
        const line = text.trim().split("\n")[1];
        if (!line) throw new Error("empty");
        const cols = line.split(",");
        const close = Number(cols[6]);
        const open = Number(cols[3]);
        if (!Number.isFinite(close)) throw new Error("bad price");
        const changePct =
          Number.isFinite(open) && open !== 0 ? ((close - open) / open) * 100 : undefined;
        return {
          id: ticker.id,
          symbol: ticker.symbol,
          name: ticker.name,
          price: close,
          changePct,
          kind: "stock" as const,
        } satisfies MarketQuote;
      } catch {
        return {
          id: ticker.id,
          symbol: ticker.symbol,
          name: ticker.name,
          price: Number.NaN,
          kind: "stock" as const,
        } satisfies MarketQuote;
      }
    }),
  );

  const live = results.filter((row) => Number.isFinite(row.price));
  if (!live.length) {
    throw new Error("Stock quotes unavailable in this browser session.");
  }
  return live;
}

export function formatMarketPrice(value: number, kind: MarketQuote["kind"]): string {
  if (!Number.isFinite(value)) return "—";
  if (kind === "forex") {
    return value >= 10 ? value.toFixed(2) : value.toFixed(4);
  }
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(4);
}

export function formatChangePct(value?: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
