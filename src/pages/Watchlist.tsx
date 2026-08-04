import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TokenCard } from "../components/TokenCard";
import { useAppIsActive } from "../hooks/useAppIsActive";
import { useOracleMarketFeed } from "../lib/useOracleMarketFeed";
import { sampleTokens } from "../data/tokens";

const WATCH_KEY = "synexus_watchlist_ids";

function readWatchIds(): string[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeWatchIds(ids: string[]) {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(ids.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export function Watchlist() {
  const appActive = useAppIsActive();
  const { tokens, loading } = useOracleMarketFeed({ enabled: appActive, intervalMs: 90_000 });
  const allTokens = tokens.length ? tokens : sampleTokens;
  const [watchIds, setWatchIds] = useState<string[]>(() => readWatchIds());
  const [query, setQuery] = useState("");

  const watched = useMemo(
    () => watchIds.map((id) => allTokens.find((t) => t.id === id)).filter(Boolean),
    [watchIds, allTokens],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? allTokens.filter((t) =>
          [t.name, t.symbol, t.mintAddress ?? ""].some((v) => v.toLowerCase().includes(q)),
        )
      : allTokens.slice(0, 12);
    return pool.filter((t) => !watchIds.includes(t.id)).slice(0, 12);
  }, [allTokens, query, watchIds]);

  function addToken(id: string) {
    setWatchIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [id, ...prev];
      writeWatchIds(next);
      return next;
    });
  }

  function removeToken(id: string) {
    setWatchIds((prev) => {
      const next = prev.filter((x) => x !== id);
      writeWatchIds(next);
      return next;
    });
  }

  return (
    <div className="page tool-page">
      <section className="tool-page__hero marketing-panel">
        <p className="tool-page__eyebrow">Watchlist</p>
        <h1 className="tool-page__title">Track what matters most</h1>
        <p className="tool-page__lede">
          Save tokens from the SyNexus feed, then jump straight into a risk scan. Saved on this device.
        </p>
        <p className="tool-page__actions">
          <Link className="tool-page__action" to="/pulse#wallet-performance">
            Wallet dashboard
          </Link>
          <Link className="tool-page__action" to="/markets">
            Markets
          </Link>
        </p>
      </section>

      <section className="marketing-panel">
        <h2>Your watchlist</h2>
        {loading && !watched.length ? <p>Loading feed…</p> : null}
        {!watched.length ? (
          <p>No saved tokens yet — add from suggestions below.</p>
        ) : (
          <ul className="token-list">
            {watched.map((token) =>
              token ? (
                <li key={token.id}>
                  <TokenCard token={token} />
                  <button
                    type="button"
                    className="watchlist-remove"
                    onClick={() => removeToken(token.id)}
                  >
                    Remove
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>

      <section className="marketing-panel">
        <h2>Add tokens</h2>
        <input
          className="coin-search-panel__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, symbol, or mint"
          aria-label="Search tokens to watch"
        />
        <ul className="token-list">
          {suggestions.map((token) => (
            <li key={token.id}>
              <TokenCard token={token} />
              <button type="button" className="watchlist-add" onClick={() => addToken(token.id)}>
                Add to watchlist
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
