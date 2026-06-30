import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchSolana5mMovers,
  type Solana5mMoversResult,
  type TokenMover5m,
} from "../services/marketDataService";

const REFRESH_MS = 45_000;

type Tab = "gainers" | "losers";

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function MoverRow({ mover, tone }: { mover: TokenMover5m; tone: Tab }) {
  const [logoBroken, setLogoBroken] = useState(false);

  return (
    <li>
      <Link to={`/token/${encodeURIComponent(mover.id)}`} className="top-movers__row">
        {mover.logoUrl && !logoBroken ? (
          <img
            className="top-movers__logo"
            src={mover.logoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setLogoBroken(true)}
          />
        ) : (
          <span className="top-movers__logo top-movers__logo--fallback" aria-hidden>
            {mover.symbol.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="top-movers__meta">
          <span className="top-movers__symbol">{mover.symbol}</span>
          <span className="top-movers__name">{mover.name}</span>
        </span>
        <span className={`top-movers__pct top-movers__pct--${tone}`}>{formatPct(mover.change5mPct)}</span>
      </Link>
    </li>
  );
}

export function TopMoversPanel() {
  const [tab, setTab] = useState<Tab>("gainers");
  const [data, setData] = useState<Solana5mMoversResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await fetchSolana5mMovers();
        if (!cancelled) setData(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const rows = tab === "gainers" ? (data?.gainers ?? []) : (data?.losers ?? []);
  const emptyLabel =
    tab === "gainers" ? "No gainers in the last 5 minutes." : "No losers in the last 5 minutes.";

  return (
    <section className="top-movers marketing-panel" aria-labelledby="top-movers-title">
      <div className="top-movers__head">
        <div>
          <h2 id="top-movers-title" className="top-movers__title">
            5-min movers
          </h2>
          <p className="top-movers__lede">Solana · last 5 minutes</p>
        </div>
        <span className={`top-movers__badge${data?.source === "live" ? " top-movers__badge--live" : ""}`}>
          {loading ? "…" : data?.source === "live" ? "Live" : "Sample"}
        </span>
      </div>

      <div className="top-movers__tabs" role="tablist" aria-label="5-minute movers">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "gainers"}
          className={`top-movers__tab${tab === "gainers" ? " top-movers__tab--active" : ""}`}
          onClick={() => setTab("gainers")}
        >
          Gainers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "losers"}
          className={`top-movers__tab${tab === "losers" ? " top-movers__tab--active" : ""}`}
          onClick={() => setTab("losers")}
        >
          Losers
        </button>
      </div>

      {loading && !data ? (
        <p className="top-movers__status">Loading movers…</p>
      ) : rows.length ? (
        <ul className="top-movers__list" role="tabpanel">
          {rows.map((mover) => (
            <MoverRow key={`${tab}-${mover.id}`} mover={mover} tone={tab} />
          ))}
        </ul>
      ) : (
        <p className="top-movers__status">{emptyLabel}</p>
      )}
    </section>
  );
}
