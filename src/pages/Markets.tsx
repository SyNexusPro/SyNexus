import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TopMoversPanel } from "../components/TopMoversPanel";
import { TokenCard } from "../components/TokenCard";
import TitanMarketChart, { type TitanChartCandle } from "../components/TitanMarketChart";
import { fetchTokenPriceHistory } from "../services/marketDataService";
import { useAppIsActive } from "../hooks/useAppIsActive";
import { useOracleMarketFeed } from "../lib/useOracleMarketFeed";
import {
  fetchForexMarkets,
  fetchGlobalCryptoMarkets,
  fetchStockMarkets,
  formatChangePct,
  formatMarketPrice,
  type MarketQuote,
} from "../lib/globalMarkets";

type Tab = "crypto" | "stocks" | "forex" | "intel";

const SOL_MINT = "So11111111111111111111111111111111111111112";

function historyCandles(
  points: Array<{ timestamp: number; priceUsd: number; open?: number; high?: number; low?: number }>,
): TitanChartCandle[] {
  const candles: TitanChartCandle[] = [];
  let prevClose: number | null = null;
  for (const point of points) {
    const close = point.priceUsd;
    if (!Number.isFinite(close) || close <= 0) continue;
    const open = point.open ?? prevClose ?? close;
    candles.push({
      time: Math.floor(point.timestamp / 1000) as TitanChartCandle["time"],
      open,
      high: point.high ?? Math.max(open, close),
      low: point.low ?? Math.min(open, close),
      close,
    });
    prevClose = close;
  }
  return candles;
}

export function Markets() {
  const [tab, setTab] = useState<Tab>("crypto");
  const appActive = useAppIsActive();
  const { tokens, loading: solLoading } = useOracleMarketFeed({
    enabled: appActive && tab === "crypto",
    intervalMs: 90_000,
  });
  const [globalCrypto, setGlobalCrypto] = useState<MarketQuote[]>([]);
  const [stocks, setStocks] = useState<MarketQuote[]>([]);
  const [forex, setForex] = useState<MarketQuote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [solCandles, setSolCandles] = useState<TitanChartCandle[]>([]);
  const [solChartNote, setSolChartNote] = useState("Loading SOL candles…");

  useEffect(() => {
    if (!appActive || (tab !== "crypto" && tab !== "intel")) return;
    let cancelled = false;
    void fetchTokenPriceHistory({ mintAddress: SOL_MINT }, "24H")
      .then((history) => {
        if (cancelled) return;
        const candles = historyCandles(history.points);
        setSolCandles(candles);
        setSolChartNote(
          candles.length >= 2
            ? `${history.provider ?? "Live"} · ${history.intervalLabel} candles · ${history.windowLabel}`
            : "SOL chart history is unavailable right now.",
        );
      })
      .catch(() => {
        if (cancelled) return;
        setSolCandles([]);
        setSolChartNote("SOL chart history is unavailable right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [appActive, tab]);

  useEffect(() => {
    if (!appActive) return;
    let cancelled = false;

    async function load() {
      setLoadingBoard(true);
      setError(null);
      try {
        if (tab === "crypto") {
          const rows = await fetchGlobalCryptoMarkets(18);
          if (!cancelled) setGlobalCrypto(rows);
        } else if (tab === "stocks") {
          const rows = await fetchStockMarkets();
          if (!cancelled) setStocks(rows);
        } else if (tab === "forex") {
          const rows = await fetchForexMarkets();
          if (!cancelled) setForex(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Market board unavailable.");
        }
      } finally {
        if (!cancelled) setLoadingBoard(false);
      }
    }

    if (tab !== "intel") void load();
    else setLoadingBoard(false);

    return () => {
      cancelled = true;
    };
  }, [tab, appActive]);

  const board = useMemo(() => {
    if (tab === "crypto") return globalCrypto;
    if (tab === "stocks") return stocks;
    if (tab === "forex") return forex;
    return [];
  }, [tab, globalCrypto, stocks, forex]);

  const trending = useMemo(
    () =>
      tokens
        .slice()
        .sort((a, b) => b.change24hPct - a.change24hPct)
        .slice(0, 6),
    [tokens],
  );

  return (
    <div className="page markets-page">
      <section className="markets-page__hero marketing-panel">
        <p className="markets-page__eyebrow">Markets</p>
        <h1 className="markets-page__title">Crypto · Stocks · Forex · Intelligence</h1>
        <p className="markets-page__lede">
          One board for global market context and Solana execution intel. Educational only — not financial advice.
        </p>
      </section>

      <div className="markets-page__tabs" role="tablist" aria-label="Market boards">
        {(
          [
            ["crypto", "Crypto"],
            ["stocks", "Stocks"],
            ["forex", "Forex"],
            ["intel", "Intelligence"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`markets-page__tab${tab === id ? " is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "intel" ? (
        <section className="markets-page__board marketing-panel">
          <div className="markets-page__board-head">
            <h2>
              {tab === "crypto" && "Global crypto markets"}
              {tab === "stocks" && "Mega-cap stocks & ETFs"}
              {tab === "forex" && "Major FX vs USD"}
            </h2>
            <p>
              {tab === "crypto" && "Top assets by market cap (CoinGecko)."}
              {tab === "stocks" && "Live session quotes when available."}
              {tab === "forex" && "ECB reference rates via Frankfurter."}
            </p>
          </div>

          {loadingBoard ? <p className="markets-page__status">Updating board…</p> : null}
          {error ? <p className="markets-page__status markets-page__status--error">{error}</p> : null}

          {!loadingBoard && !error && board.length ? (
            <ul className="markets-quote-list">
              {board.map((row) => (
                <li key={row.id} className="markets-quote">
                  <span className="markets-quote__symbol">{row.symbol}</span>
                  <span className="markets-quote__name">{row.name}</span>
                  <span className="markets-quote__price">
                    {tab === "forex" ? "" : "$"}
                    {formatMarketPrice(row.price, row.kind)}
                  </span>
                  <span
                    className={`markets-quote__chg${
                      (row.changePct ?? 0) >= 0 ? " is-up" : " is-down"
                    }`}
                  >
                    {formatChangePct(row.changePct)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <section className="markets-page__intel marketing-panel">
          <h2>Market intelligence</h2>
          <div className="markets-page__titan-chart">
            <p className="markets-page__status">{solChartNote}</p>
            {solCandles.length >= 2 ? <TitanMarketChart symbol="SOL/USD" candles={solCandles} /> : null}
          </div>
          <ul className="markets-page__intel-list">
            <li>
              <strong>Crypto beta</strong> — Solana movers and Sentinel risk reads before you size a swap.
            </li>
            <li>
              <strong>Macro / FX</strong> — Dollar strength can pressure risk assets; use the Forex board for USD pairs.
            </li>
            <li>
              <strong>Equities cross-check</strong> — Mega-cap tech often leads crypto risk appetite intraday.
            </li>
            <li>
              <Link to="/news">Open News Intelligence</Link> for catalysts, hacks, ETF headlines, and event impact.
            </li>
          </ul>
        </section>
      )}

      {tab === "crypto" ? (
        <>
          <section className="markets-page__intel marketing-panel">
            <h2>SOL / USD</h2>
            <p className="markets-page__status">{solChartNote}</p>
            {solCandles.length >= 2 ? <TitanMarketChart symbol="SOL/USD" candles={solCandles} /> : null}
          </section>
          <TopMoversPanel />
          <section className="token-section">
            <div className="token-section__head">
              <h2 className="token-section__title">Solana feed</h2>
              <p className="token-section__lede">
                {solLoading ? "Loading…" : "Scan any mint before you trade"}
              </p>
            </div>
            <ul className="token-list">
              {trending.map((token) => (
                <li key={token.id}>
                  <TokenCard token={token} />
                </li>
              ))}
            </ul>
            <p className="markets-page__cta">
              <Link to="/#scan">Open token scanner →</Link>
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
