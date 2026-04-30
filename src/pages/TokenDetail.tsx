import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { submitHiveMindReport } from "../lib/reportSubmission";
import type { Token } from "../data/tokens";
import { fetchTokenDetailById } from "../services/marketDataService";

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1 ? 2 : 8,
  });
}

export function TokenDetail() {
  const { tokenId } = useParams();
  const [token, setToken] = useState<Token | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNote, setReportNote] = useState<string | null>(null);

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
      })
      .catch(() => {
        setToken(null);
        setLoadState("error");
      });
  }, [tokenId]);

  async function handleReport() {
    if (!token) return;
    setReportBusy(true);
    setReportNote(null);
    const result = await submitHiveMindReport({
      tokenSymbol: token.symbol,
      tokenName: token.name,
      tokenAddress: token.mintAddress,
      details: reportDetails.trim() || undefined,
    });
    setReportBusy(false);
    if (result.ok) {
      setReportNote(
        result.channel === "supabase"
          ? "Report submitted to HiveMind."
          : "Saved on this device. Sign in on Pulse to sync.",
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

  const dexscreenerUrl = token.mintAddress
    ? `https://dexscreener.com/solana/${token.mintAddress}`
    : "https://dexscreener.com";
  const explorerUrl = token.mintAddress
    ? `https://solscan.io/token/${token.mintAddress}`
    : "https://solscan.io";

  return (
    <div className="page">
      <section className="detail-header">
        <p className="detail-header__eyebrow">Token detail</p>
        <h1 className="detail-header__title">
          {token.name} ({token.symbol})
        </h1>
        <p className="detail-header__contract">
          Contract: <span>{token.mintAddress ?? "Not available"}</span>
        </p>
      </section>

      <section className="detail-chart">
        <div className="detail-chart__head">
          <h2>Chart</h2>
          <span>24H</span>
        </div>
        <div className="detail-chart__grid" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
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

      <section className="detail-guardian">
        <h2>Watchers of the Hive</h2>
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
        <a href={dexscreenerUrl} target="_blank" rel="noopener noreferrer">
          Open DexScreener
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
