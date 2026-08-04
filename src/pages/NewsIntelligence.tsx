import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppIsActive } from "../hooks/useAppIsActive";
import {
  fetchCryptoNewsIntel,
  formatNewsTime,
  type CryptoNewsItem,
} from "../lib/cryptoNews";

type Filter = "all" | "high" | "medium" | "watch";

export function NewsIntelligence() {
  const appActive = useAppIsActive();
  const [items, setItems] = useState<CryptoNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!appActive) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchCryptoNewsIntel(40);
        if (!cancelled) {
          setItems(rows);
          setUpdatedAt(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load news.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appActive]);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.impact === filter);
  }, [items, filter]);

  return (
    <div className="page news-page">
      <section className="news-page__hero marketing-panel">
        <p className="news-page__eyebrow">News Intelligence</p>
        <h1 className="news-page__title">World crypto news · impact · insights</h1>
        <p className="news-page__lede">
          Up-to-date headlines across Bitcoin, Ethereum, Solana, regulation, hacks, and macro — tagged for
          event impact so you can brief Titan or scan risk faster. Not financial advice.
        </p>
        {updatedAt ? (
          <p className="news-page__updated">Updated {formatNewsTime(updatedAt)}</p>
        ) : null}
      </section>

      <div className="news-page__filters" role="toolbar" aria-label="Filter by impact">
        {(
          [
            ["all", "All"],
            ["high", "High impact"],
            ["medium", "Market"],
            ["watch", "Watch"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`news-page__filter${filter === id ? " is-active" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="news-page__status">Loading live wire…</p> : null}
      {error ? <p className="news-page__status news-page__status--error">{error}</p> : null}

      <ul className="news-page__list">
        {visible.map((item) => (
          <li key={item.id}>
            <article className="news-card marketing-panel">
              <div className="news-card__meta">
                <span className={`news-card__impact news-card__impact--${item.impact}`}>
                  {item.impact === "high"
                    ? "High impact"
                    : item.impact === "medium"
                      ? "Market insight"
                      : "Watch"}
                </span>
                <span className="news-card__source">{item.source}</span>
                <time dateTime={new Date(item.publishedAt).toISOString()}>
                  {formatNewsTime(item.publishedAt)}
                </time>
              </div>
              <h2 className="news-card__title">
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </h2>
              {item.body ? <p className="news-card__body">{item.body}</p> : null}
              <p className="news-card__insight">{item.insight}</p>
              {item.categories.length ? (
                <p className="news-card__tags">{item.categories.slice(0, 4).join(" · ")}</p>
              ) : null}
            </article>
          </li>
        ))}
      </ul>

      {!loading && !error && visible.length === 0 ? (
        <p className="news-page__status">No headlines in this filter right now.</p>
      ) : null}

      <section className="news-page__aside marketing-panel">
        <h2>Also in SyNexus</h2>
        <p>
          <Link to="/markets">Markets board</Link> for crypto, stocks, and forex ·{" "}
          <Link to="/blog">SyNexus Journal</Link> for deeper educational guides · ask Titan to brief any
          headline.
        </p>
      </section>
    </div>
  );
}
