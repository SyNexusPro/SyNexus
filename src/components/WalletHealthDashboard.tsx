import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWalletHealthReport } from "../lib/walletHealth";
import { formatJournalPct, formatJournalUsd, JOURNAL_UPDATED_EVENT } from "../lib/tradeJournal";

type Props = {
  embedded?: boolean;
};

export function WalletHealthDashboard({ embedded = false }: Props) {
  const [stamp, setStamp] = useState(0);
  const refresh = useCallback(() => setStamp(Date.now()), []);

  useEffect(() => {
    window.addEventListener(JOURNAL_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(JOURNAL_UPDATED_EVENT, refresh);
  }, [refresh]);

  const report = useMemo(() => buildWalletHealthReport(), [stamp]);

  return (
    <section
      className={`wallet-health${embedded ? " wallet-health--embedded" : ""}`}
      aria-labelledby={embedded ? undefined : "wallet-health-title"}
    >
      {!embedded ? (
        <div className="wallet-health__head">
          <p className="wallet-health__eyebrow">Your trading DNA</p>
          <h2 className="wallet-health__title" id="wallet-health-title">
            Wallet health
          </h2>
          <p className="wallet-health__lede">
            Wins, losses, risk habits, and suggestions — stats about you, not just the coins.
          </p>
          <button type="button" className="wallet-health__refresh" onClick={refresh}>
            Refresh stats
          </button>
          <a href="#trade-journal" className="wallet-health__journal-link">
            Open trade journal →
          </a>
        </div>
      ) : (
        <div className="wallet-health__head wallet-health__head--embedded">
          <button type="button" className="wallet-health__refresh" onClick={refresh}>
            Refresh stats
          </button>
        </div>
      )}

      <div className="wallet-health__stats">
        <article>
          <p>Trades logged</p>
          <strong>{report.totalTrades}</strong>
        </article>
        <article>
          <p>Win rate</p>
          <strong>{report.hasData ? `${report.winRatePct}%` : "—"}</strong>
        </article>
        <article>
          <p>Wins / losses</p>
          <strong>
            {report.wins} / {report.losses}
          </strong>
        </article>
        <article>
          <p>Open positions</p>
          <strong>{report.openTrades}</strong>
        </article>
        <article>
          <p>Net P/L</p>
          <strong>{report.hasData && report.sells > 0 ? formatJournalUsd(report.totalProfitLossUsd) : "—"}</strong>
        </article>
      </div>

      <div className="wallet-health__highlights">
        <article className="wallet-health__highlight">
          <p>Best trade</p>
          {report.bestTrade ? (
            <>
              <strong>{report.bestTrade.symbol}</strong>
              <span className="wallet-health__pct wallet-health__pct--up">
                {formatJournalPct(report.bestTrade.profitLossPct)}
              </span>
            </>
          ) : (
            <span className="wallet-health__empty">Log buys from token pages to track.</span>
          )}
        </article>
        <article className="wallet-health__highlight">
          <p>Worst trade</p>
          {report.worstTrade ? (
            <>
              <strong>{report.worstTrade.symbol}</strong>
              <span className="wallet-health__pct wallet-health__pct--down">
                {formatJournalPct(report.worstTrade.profitLossPct)}
              </span>
            </>
          ) : (
            <span className="wallet-health__empty">No exits logged yet.</span>
          )}
        </article>
      </div>

      <div className="wallet-health__columns">
        <div>
          <h3>Risk habits</h3>
          <ul>
            {report.riskHabits.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Suggestions</h3>
          <ul>
            {report.suggestions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
