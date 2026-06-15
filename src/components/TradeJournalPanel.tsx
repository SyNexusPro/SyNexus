import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildJournalSummary,
  deleteTradeRecord,
  formatJournalDate,
  formatJournalPct,
  formatJournalPrice,
  formatJournalUsd,
  getTradeJournal,
  JOURNAL_UPDATED_EVENT,
  updateTradeNotes,
  type TradeRecord,
} from "../lib/tradeJournal";

type Filter = "all" | "open" | "closed";

function useJournalRefresh() {
  const [stamp, setStamp] = useState(0);
  const refresh = useCallback(() => setStamp(Date.now()), []);

  useEffect(() => {
    window.addEventListener(JOURNAL_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(JOURNAL_UPDATED_EVENT, refresh);
  }, [refresh]);

  return { stamp, refresh };
}

function NoteField({ record, onSaved }: { record: TradeRecord; onSaved: () => void }) {
  const [draft, setDraft] = useState(record.notes);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(record.notes);
  }, [record.notes]);

  function handleSave() {
    updateTradeNotes(record.id, draft);
    setSaved(true);
    onSaved();
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="trade-journal__notes">
      <label htmlFor={`note-${record.id}`}>Notes</label>
      <textarea
        id={`note-${record.id}`}
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Why you entered, exit plan, lessons…"
      />
      <button type="button" onClick={handleSave}>
        {saved ? "Saved" : "Save note"}
      </button>
    </div>
  );
}

function TradeRow({ record, onChange }: { record: TradeRecord; onChange: () => void }) {
  const isOpen = record.status === "open";
  const pnl = record.profitLossPct;
  const pnlUsd = record.profitLossUsd;
  const pnlClass =
    pnl == null ? "" : pnl > 0 ? "trade-journal__pnl--win" : pnl < 0 ? "trade-journal__pnl--loss" : "";

  return (
    <li className={`trade-journal__row trade-journal__row--${record.status}`}>
      <div className="trade-journal__row-top">
        <div>
          <p className="trade-journal__symbol">
            {record.symbol}
            <span>{record.name}</span>
          </p>
          <p className="trade-journal__status">{isOpen ? "Open position" : "Closed"}</p>
        </div>
        {!isOpen && pnl != null ? (
          <div className={`trade-journal__pnl ${pnlClass}`}>
            <strong>{formatJournalPct(pnl)}</strong>
            {pnlUsd != null ? <span>{formatJournalUsd(pnlUsd)}</span> : null}
          </div>
        ) : (
          <span className="trade-journal__pnl trade-journal__pnl--open">Awaiting exit</span>
        )}
      </div>

      <dl className="trade-journal__details">
        <div>
          <dt>Entry</dt>
          <dd>
            {formatJournalDate(record.entryTimestamp)}
            <span>{formatJournalPrice(record.entryPriceUsd)} · ~{formatJournalUsd(record.entryUsd)}</span>
          </dd>
        </div>
        {!isOpen && record.exitTimestamp ? (
          <div>
            <dt>Exit</dt>
            <dd>
              {formatJournalDate(record.exitTimestamp)}
              <span>
                {formatJournalPrice(record.exitPriceUsd ?? 0)} · ~{formatJournalUsd(record.exitUsd ?? 0)}
              </span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Risk at entry</dt>
          <dd>
            {record.entryRiskScore}/100 · {record.entryGuardianRisk}
          </dd>
        </div>
      </dl>

      <NoteField record={record} onSaved={onChange} />

      <div className="trade-journal__row-actions">
        {record.tokenId ? (
          <Link to={`/token/${record.tokenId}`}>View token</Link>
        ) : null}
        <button type="button" className="trade-journal__delete" onClick={() => deleteTradeRecord(record.id)}>
          Remove
        </button>
      </div>
    </li>
  );
}

export function TradeJournalPanel({ embedded = false }: { embedded?: boolean }) {
  const { stamp, refresh } = useJournalRefresh();
  const [filter, setFilter] = useState<Filter>("all");

  const summary = useMemo(() => buildJournalSummary(), [stamp]);
  const trades = useMemo(() => {
    const all = getTradeJournal();
    if (filter === "open") return all.filter((t) => t.status === "open");
    if (filter === "closed") return all.filter((t) => t.status === "closed");
    return all;
  }, [stamp, filter]);

  const netPnlClass =
    summary.totalProfitLossUsd > 0
      ? "trade-journal__summary-pnl--win"
      : summary.totalProfitLossUsd < 0
        ? "trade-journal__summary-pnl--loss"
        : "";

  return (
    <section
      className={`trade-journal${embedded ? " trade-journal--embedded" : ""}`}
      id="trade-journal"
      aria-labelledby={embedded ? undefined : "trade-journal-title"}
    >
      {!embedded ? (
        <div className="trade-journal__head">
          <p className="trade-journal__eyebrow">Auto-tracked</p>
          <h2 className="trade-journal__title" id="trade-journal-title">
            Trade journal
          </h2>
          <p className="trade-journal__lede">
            Every Buy logs entry. Every Sell closes the position and calculates profit or loss. Add notes anytime.
          </p>
        </div>
      ) : null}

      <div className="trade-journal__summary">
        <article>
          <p>Total</p>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <p>Open</p>
          <strong>{summary.open}</strong>
        </article>
        <article>
          <p>Closed</p>
          <strong>{summary.closed}</strong>
        </article>
        <article>
          <p>Win rate</p>
          <strong>{summary.wins + summary.losses > 0 ? `${summary.winRatePct}%` : "—"}</strong>
        </article>
        <article className={`trade-journal__summary-pnl ${netPnlClass}`}>
          <p>Net P/L</p>
          <strong>{summary.closed > 0 ? formatJournalUsd(summary.totalProfitLossUsd) : "—"}</strong>
        </article>
      </div>

      <div className="trade-journal__filters" role="tablist" aria-label="Filter journal">
        {(["all", "open", "closed"] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? "is-active" : ""}
            onClick={() => setFilter(key)}
          >
            {key === "all" ? "All" : key === "open" ? "Open" : "Closed"}
          </button>
        ))}
        <button type="button" className="trade-journal__refresh" onClick={refresh}>
          Refresh
        </button>
      </div>

      {trades.length ? (
        <ul className="trade-journal__list">
          {trades.map((record) => (
            <TradeRow key={record.id} record={record} onChange={refresh} />
          ))}
        </ul>
      ) : (
        <p className="trade-journal__empty">
          No journal entries yet. Tap <strong>Buy</strong> or <strong>Sell</strong> on any token — Synexus logs entry,
          exit, and P/L automatically.
        </p>
      )}
    </section>
  );
}
