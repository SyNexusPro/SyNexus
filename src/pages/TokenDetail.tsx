import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TokenLogo } from "../components/TokenLogo";
import { ScanHealthPanel } from "../components/ScanHealthPanel";
import { ShouldIBuyVerdict } from "../components/ShouldIBuyPanel";
import { TradeIntelligenceScorecard } from "../components/TradeIntelligenceScorecard";
import { TradeIntelBuyLink } from "../components/TradeIntelBuyLink";
import {
  TitanMarketChart,
  type TitanChartCandle,
  type TitanChartLinePoint,
} from "../components/TitanMarketChart";
import { submitSynexusReport } from "../lib/reportSubmission";
import { recordTokenView } from "../lib/walletHealth";
import { trackSiteEvent } from "../lib/siteAnalytics";
import { dexScreenerTokenUrl, jupiterBuyWithSolUrl, jupiterSellForSolUrl } from "../lib/solanaTradeLinks";
import { getTradingFeeBps } from "../lib/tradingFees";
import { useSynexusPlan } from "../hooks/useSynexusPlan";
import { isTradingEnabled, tradePath } from "../config/trading";
import { SYN_MINT, SYN_PUMPFUN_URL } from "../config/synToken";
import type { Token } from "../data/tokens";
import {
  fetchTokenDetailById,
  fetchTokenPriceHistory,
  type PriceHistoryPoint,
  type PriceHistoryRange,
  type PriceHistoryResult,
} from "../services/marketDataService";
import type { UTCTimestamp } from "lightweight-charts";

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1 ? 2 : 8,
  });
}

const CHART_RANGE_META: Record<PriceHistoryRange, { button: string; refreshMs: number }> = {
  "1H": { button: "1 hr", refreshMs: 15_000 },
  "24H": { button: "24 hr", refreshMs: 60_000 },
  "1MO": { button: "1 mo", refreshMs: 60_000 },
};

const chartRanges: PriceHistoryRange[] = ["1H", "24H", "1MO"];

/** Build OHLC candles from close-only history for TitanMarketChart. */
function historyToChartSeries(points: PriceHistoryPoint[]): {
  candles: TitanChartCandle[];
  lineData: TitanChartLinePoint[];
} {
  const candles: TitanChartCandle[] = [];
  const lineData: TitanChartLinePoint[] = [];
  let prevClose: number | null = null;

  for (const point of points) {
    const time = Math.floor(point.timestamp / 1000) as UTCTimestamp;
    const close = point.priceUsd;
    if (!Number.isFinite(close) || close <= 0) continue;
    const open = prevClose ?? close;
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    candles.push({ time, open, high, low, close });
    lineData.push({ time, value: close });
    prevClose = close;
  }

  return { candles, lineData };
}

export function TokenDetail() {
  const { tokenId } = useParams();
  const plan = useSynexusPlan();
  const feeBps = getTradingFeeBps(plan);
  const swapOpts = { feeBps };
  const [token, setToken] = useState<Token | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNote, setReportNote] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<PriceHistoryRange>("24H");
  const [priceHistory, setPriceHistory] = useState<PriceHistoryResult | null>(null);
  const [chartState, setChartState] = useState<"loading" | "ready" | "error">("loading");
  const [chartTick, setChartTick] = useState(() => Date.now());

  useEffect(() => {
    if (!tokenId) {
      setLoadState("error");
      return;
    }
    setLoadState("loading");
    fetchTokenDetailById(tokenId)
      .then((detail) => {
        setToken(detail);
        setLoadState("ready");
        if (detail) {
          trackSiteEvent("token_view", {
            path: `/token/${detail.id}`,
            meta: { symbol: detail.symbol },
          });
        }
      })
      .catch(() => {
        setToken(null);
        setLoadState("error");
      });
  }, [tokenId]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function loadChart() {
      if (!token) return;
      setChartState("loading");
      try {
        const history = await fetchTokenPriceHistory(token, chartRange);
        if (cancelled) return;
        setPriceHistory(history);
        setChartState("ready");
      } catch {
        if (cancelled) return;
        setPriceHistory(null);
        setChartState("error");
      }
    }

    void loadChart();
    const intervalId = window.setInterval(() => void loadChart(), CHART_RANGE_META[chartRange].refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [chartRange, token]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setChartTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (token) recordTokenView(token);
  }, [token]);

  async function handleReport() {
    if (!token) return;
    setReportBusy(true);
    setReportNote(null);
    const result = await submitSynexusReport({
      tokenSymbol: token.symbol,
      tokenName: token.name,
      tokenAddress: token.mintAddress,
      details: reportDetails.trim() || undefined,
    });
    setReportBusy(false);
      if (result.ok) {
        setReportNote(
          result.channel === "supabase"
            ? "Report submitted to SyNexus."
            : "Report saved on this device.",
        );
      setReportDetails("");
    } else {
      setReportNote(result.message);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="page">
        <div className="detail-loading">
          <p className="detail-loading__pulse">Loading token…</p>
        </div>
      </div>
    );
  }

  if (loadState === "error" || !token) {
    return (
      <div className="page">
        <div className="feed-status feed-status--error">
          {loadState === "error"
            ? "Could not load this token. Try again later."
            : "Token not found."}
        </div>
        <Link to="/" className="detail-back">
          Back to feed
        </Link>
      </div>
    );
  }

  const isSynMint = token.mintAddress === SYN_MINT;
  const chartUrl = isSynMint ? SYN_PUMPFUN_URL : dexScreenerTokenUrl(token.mintAddress, token.symbol);
  const buySwapUrl = isSynMint ? SYN_PUMPFUN_URL : jupiterBuyWithSolUrl(token.mintAddress, swapOpts) ?? chartUrl;
  const sellSwapUrl = isSynMint ? SYN_PUMPFUN_URL : jupiterSellForSolUrl(token.mintAddress, swapOpts) ?? chartUrl;
  const explorerUrl = token.mintAddress
    ? `https://solscan.io/token/${token.mintAddress}`
    : "https://solscan.io";
  const chartSeries = historyToChartSeries(priceHistory?.points ?? []);
  const latestPoint = priceHistory?.points.at(-1);
  const firstPoint = priceHistory?.points[0];
  const latestPrice = latestPoint?.priceUsd ?? token.priceUsd;
  const firstPrice = firstPoint?.priceUsd ?? token.priceUsd;
  const chartChangePct = firstPrice ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0;
  const secondsSinceUpdate = priceHistory
    ? Math.max(0, Math.floor((chartTick - priceHistory.updatedAt) / 1000))
    : 0;

  return (
    <div className="page">
      <section className="detail-header">
        <div className="detail-header__brand">
          <TokenLogo token={token} size="md" />
          <div className="detail-header__titles">
            <p className="detail-header__eyebrow">Token detail</p>
            <h1 className="detail-header__title">
              {token.name} ({token.symbol})
            </h1>
            <p className="detail-header__contract">
              Contract:{" "}
              {isSynMint ? (
                <a href={SYN_PUMPFUN_URL} target="_blank" rel="noopener noreferrer">
                  {token.mintAddress}
                </a>
              ) : (
                <span>{token.mintAddress ?? "Not available"}</span>
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="detail-chart">
        <div className="detail-chart__head">
          <div>
            <h2>Live price graph</h2>
            <p>
              {priceHistory?.source === "live"
                ? `${priceHistory.intervalLabel} candles · ${priceHistory.windowLabel}`
                : "Preview line until live history is available"}
            </p>
          </div>
          <span>{secondsSinceUpdate}s ago</span>
        </div>
        <div className="detail-chart__toolbar" aria-label="Chart range">
          {chartRanges.map((range) => (
            <button
              type="button"
              className={chartRange === range ? "is-active" : ""}
              key={range}
              onClick={() => setChartRange(range)}
            >
              {CHART_RANGE_META[range].button}
            </button>
          ))}
        </div>
        <div className="detail-chart__line-wrap detail-chart__line-wrap--titan">
          {chartState === "error" ? (
            <p className="detail-chart__empty">Could not load chart history.</p>
          ) : chartState === "loading" && !priceHistory ? (
            <p className="detail-chart__empty">Loading Titan market chart...</p>
          ) : (
            <TitanMarketChart
              symbol={`${token.symbol}/USD`}
              candles={chartSeries.candles}
              lineData={chartSeries.lineData}
            />
          )}
          <div className="detail-chart__value">
            <p>{formatUsd(latestPrice)}</p>
            <span className={chartChangePct >= 0 ? "is-up" : "is-down"}>
              {chartChangePct >= 0 ? "+" : ""}
              {chartChangePct.toFixed(2)}%
            </span>
          </div>
        </div>
      </section>

      <section className="detail-metrics">
        <article>
          <p>Price</p>
          <h3>{formatUsd(token.priceUsd)}</h3>
        </article>
        <article>
          <p>Volume</p>
          <h3>{formatUsd(token.volume24hUsd ?? 0)}</h3>
        </article>
        <article>
          <p>Liquidity</p>
          <h3>{formatUsd(token.liquidityUsd ?? 0)}</h3>
        </article>
        <article>
          <p>Market cap</p>
          <h3>{formatUsd(token.marketCapUsd ?? 0)}</h3>
        </article>
      </section>

      <ScanHealthPanel token={token} />
      <TradeIntelligenceScorecard token={token} />
      <ShouldIBuyVerdict token={token} />

      <section className="detail-trade-panel">
        <div>
          <h2>Trade actions</h2>
          <p>
            {isTradingEnabled()
              ? isSynMint
                ? "Swap in SyNexus uses Jupiter routes plus Titan safety. $SYN still trades on pump.fun until it graduates."
                : "Swap in SyNexus uses Jupiter routes plus Titan safety. External Jupiter and DexScreener stay available."
              : isSynMint
                ? "Buy and sell $SYN on pump.fun — connect your wallet there."
                : "Jupiter opens with SOL swaps prefilled — connect your wallet and confirm. Charts stay on DexScreener."}
          </p>
        </div>
        <div className="detail-trade-panel__actions">
          {isTradingEnabled() && token.mintAddress ? (
            <Link to={tradePath({ mint: token.mintAddress, side: "buy" })} className="detail-trade-panel__buy">
              Swap in SyNexus
            </Link>
          ) : null}
          <TradeIntelBuyLink
            token={token}
            href={buySwapUrl}
            className="detail-trade-panel__buy"
            side="buy"
          >
            {isSynMint ? `Buy ${token.symbol} on pump.fun` : `Buy ${token.symbol}`}
          </TradeIntelBuyLink>
          <TradeIntelBuyLink token={token} href={sellSwapUrl} side="sell">
            {isSynMint ? `Sell ${token.symbol} on pump.fun` : `Sell ${token.symbol}`}
          </TradeIntelBuyLink>
          <a href={chartUrl} target="_blank" rel="noopener noreferrer" className="detail-trade-panel__charts">
            {isSynMint ? "pump.fun" : "Charts"}
          </a>
        </div>
      </section>

      <section className="detail-guardian">
        <h2>The SyNexus</h2>
        <p className="detail-guardian__lede">Sentinel intelligence for this token</p>
        <p>{token.guardianMessage}</p>
      </section>

      <section className="detail-risk">
        <h2>Risk score</h2>
        <p className="detail-risk__score">{token.riskScore ?? 50}/100</p>
        {token.confidence != null ? (
          <p className="detail-risk__confidence">Confidence: {token.confidence}%</p>
        ) : null}
        <h3>Risk reasons</h3>
        <ul>
          {(token.riskReasons ?? ["No detailed reasons yet."]).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>

      <section className="detail-report-block">
        <label className="detail-report-block__label" htmlFor="report-details">
          Report suspicious token (optional note)
        </label>
        <textarea
          id="report-details"
          className="detail-report-block__textarea"
          rows={3}
          value={reportDetails}
          onChange={(e) => setReportDetails(e.target.value)}
          placeholder="Why does this look suspicious?"
        />
        <button
          type="button"
          className="detail-report"
          disabled={reportBusy}
          onClick={handleReport}
        >
          {reportBusy ? "Submitting…" : "Submit report"}
        </button>
        {reportNote ? <p className="detail-report-block__note">{reportNote}</p> : null}
      </section>

      <section className="detail-links">
        <h2>External links</h2>
        <a href={chartUrl} target="_blank" rel="noopener noreferrer">
          {isSynMint ? "Open pump.fun" : "Open DexScreener"}
        </a>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
          Open Solana explorer
        </a>
      </section>

      <Link to="/" className="detail-back">
        Back to feed
      </Link>
    </div>
  );
}
