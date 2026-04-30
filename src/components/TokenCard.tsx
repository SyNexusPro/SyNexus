import { useState } from "react";
import { Link } from "react-router-dom";
import { submitHiveMindReport } from "../lib/reportSubmission";
import type { GuardianRisk, Token } from "../data/tokens";

const riskStyles: Record<
  GuardianRisk,
  { label: string; dot: string; border: string }
> = {
  SAFE: {
    label: "var(--risk-safe)",
    dot: "var(--risk-safe)",
    border: "rgba(52, 211, 153, 0.35)",
  },
  WARNING: {
    label: "var(--risk-warning)",
    dot: "var(--risk-warning)",
    border: "rgba(251, 191, 36, 0.35)",
  },
  DANGER: {
    label: "var(--risk-danger)",
    dot: "var(--risk-danger)",
    border: "rgba(248, 113, 113, 0.35)",
  },
};

function formatUsd(n: number): string {
  if (n >= 1) {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (n >= 0.01) {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 8,
  });
}

type Props = { token: Token };

export function TokenCard({ token }: Props) {
  const risk = riskStyles[token.guardianRisk];
  const up = token.change24hPct >= 0;
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNote, setReportNote] = useState<string | null>(null);

  async function handleReport() {
    setReportBusy(true);
    setReportNote(null);
    const result = await submitHiveMindReport({
      tokenSymbol: token.symbol,
      tokenName: token.name,
      tokenAddress: token.mintAddress,
    });
    setReportBusy(false);
    if (result.ok) {
      setReportNote(
        result.channel === "supabase"
          ? "Report submitted."
          : "Saved locally. Sign in on Pulse to sync to HiveMind.",
      );
    } else {
      setReportNote(result.message);
    }
  }

  return (
    <article className="token-card">
      <div className="token-card__top">
        <div className="token-card__identity">
          <div className="token-card__avatar" aria-hidden>
            {token.symbol.slice(0, 2)}
          </div>
          <div>
            <h2 className="token-card__name">{token.name}</h2>
            <p className="token-card__symbol">{token.symbol}</p>
          </div>
        </div>
        <div
          className="token-card__risk"
          style={{ borderColor: risk.border, color: risk.label }}
        >
          <span
            className="token-card__risk-dot"
            style={{ background: risk.dot }}
          />
          Guardian · {token.guardianRisk}
        </div>
      </div>
      <div className="token-card__bottom">
        <div>
          <p className="token-card__muted">Price</p>
          <p className="token-card__price">{formatUsd(token.priceUsd)}</p>
        </div>
        <div className="token-card__change-wrap">
          <p className="token-card__muted">24h</p>
          <p className={`token-card__change ${up ? "is-up" : "is-down"}`}>
            {up ? "+" : ""}
            {token.change24hPct.toFixed(2)}%
          </p>
        </div>
      </div>
      <p className="token-card__message">{token.guardianMessage}</p>
      {token.mintAddress ? (
        <p className="token-card__mint">
          Mint: <span>{token.mintAddress}</span>
        </p>
      ) : null}
      <div className="token-card__actions">
        <button
          type="button"
          className="token-card__report"
          disabled={reportBusy}
          onClick={handleReport}
        >
          {reportBusy ? "Sending…" : "Report token"}
        </button>
        <Link to={`/token/${token.id}`} className="token-card__details">
          View details
        </Link>
      </div>
      {reportNote ? <p className="token-card__report-status">{reportNote}</p> : null}
    </article>
  );
}
