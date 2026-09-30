import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isTradingEnabled, tradePath } from "../../config/trading";
import { assessSwapToken } from "../../lib/swapSafety";
import { realtime } from "../../lib/realtime/RealtimeManager";
import { useRealtimeDashboard } from "../../lib/realtime/useRealtimeDashboard";
import type { TapeToken } from "../../lib/realtime/types";
import { buildTokenFromPartial } from "../../data/tokens";
import { searchTradeTokens } from "../../services/marketDataService";
import { withTimeout } from "../../lib/withTimeout";

const WATCH_KEY = "synexus_watchlist_ids";
const SOLANA_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function solanaRouteId(value: string | null | undefined): string | null {
  const id = value?.trim() ?? "";
  return SOLANA_MINT.test(id) ? id : null;
}

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

function money(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
}

function asToken(row: TapeToken) {
  return buildTokenFromPartial({
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    priceUsd: row.priceUsd,
    change24hPct: row.change24hPct,
    mintAddress: row.mint,
    marketCapUsd: row.marketCapUsd,
    liquidityUsd: row.liquidityUsd,
    volume24hUsd: row.volume24hUsd,
  });
}

export function HomeTape() {
  const dash = useRealtimeDashboard();
  const navigate = useNavigate();
  const trading = isTradingEnabled();
  const [tab, setTab] = useState<"watch" | "trending" | "new">("trending");
  const [query, setQuery] = useState("");
  const [watchIds, setWatchIds] = useState<string[]>(() => readWatchIds());
  const [selected, setSelected] = useState<TapeToken | null>(null);
  const [hera, setHera] = useState("");
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const streamRef = useRef(0);
  const lookupGen = useRef(0);
  const lookupBusyRef = useRef(false);

  useEffect(() => () => window.clearInterval(streamRef.current), []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = dash.tokens;
    if (tab === "watch") {
      const ids = new Set(watchIds);
      list = list.filter((token) => ids.has(token.id) || ids.has(token.mint));
    } else if (tab === "trending") {
      list = [...list].sort((a, b) => b.change24hPct - a.change24hPct);
    } else {
      list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    }
    if (!q) return list.slice(0, 12);
    return list
      .filter((token) =>
        [token.symbol, token.name, token.mint].some((value) => value.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [dash.tokens, query, tab, watchIds]);

  function openToken(token: TapeToken) {
    lookupGen.current += 1;
    lookupBusyRef.current = false;
    setLookupBusy(false);
    setLookupError(null);
    setSelected(token);
    setPrevPrice(token.priceUsd);
    setHera("");
    const words = assessSwapToken(asToken(token)).explanation.split(/\s+/).filter(Boolean);
    let index = 0;
    window.clearInterval(streamRef.current);
    streamRef.current = window.setInterval(() => {
      index += 1;
      setHera(words.slice(0, index).join(" "));
      if (index >= words.length) {
        window.clearInterval(streamRef.current);
        realtime.publish("HERA_RESPONSE", `${token.symbol} read complete`, token.mint);
      }
    }, 28);
    realtime.publish("SCAN_COMPLETE", token.symbol, token.mint);
    const routeId = solanaRouteId(token.mint || token.id);
    if (!routeId) {
      setLookupError(`${token.symbol} doesn't have a Solana mint, so it can't be opened.`);
      return;
    }
    navigate(`/token/${encodeURIComponent(routeId)}`);
  }

  async function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    const q = query.trim();
    if (!q || lookupBusyRef.current) return;

    const localMatches = dash.tokens.filter((token) => {
      const lower = q.toLowerCase();
      return (
        token.symbol.toLowerCase() === lower ||
        token.mint.toLowerCase() === lower ||
        token.name.toLowerCase() === lower
      );
    });
    if (localMatches.length > 1 && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      setLookupError("Several tokens use that name. Paste the mint address.");
      return;
    }
    const local = localMatches[0];
    if (local) {
      openToken(local);
      return;
    }

    const gen = ++lookupGen.current;
    lookupBusyRef.current = true;
    setLookupBusy(true);
    setLookupError(null);
    try {
      const hits = await withTimeout(searchTradeTokens(q));
      if (gen !== lookupGen.current) return;
      if (hits.length > 1 && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
        setLookupError("Several tokens use that name. Paste the mint address.");
        return;
      }
      const token = hits[0];
      const routeId = solanaRouteId(token?.mintAddress);
      if (!token || !routeId) {
        setLookupError(`No token found for “${q}”. Check the symbol or paste a Solana mint address.`);
        return;
      }
      navigate(`/token/${encodeURIComponent(routeId)}`);
    } catch (err) {
      if (gen !== lookupGen.current) return;
      setLookupError(err instanceof Error ? err.message : "Token lookup failed. Check your connection and try again.");
    } finally {
      if (gen === lookupGen.current) {
        lookupBusyRef.current = false;
        setLookupBusy(false);
      }
    }
  }

  function toggleWatch(token: TapeToken) {
    setWatchIds((current) => {
      const has = current.includes(token.id) || current.includes(token.mint);
      const next = has ? current.filter((id) => id !== token.id && id !== token.mint) : [...current, token.id];
      writeWatchIds(next);
      realtime.publish("WATCHLIST_ALERT", `${has ? "Removed" : "Added"} ${token.symbol}`, token.mint);
      return next;
    });
  }

  const liveSelected = selected
    ? dash.tokens.find((token) => token.mint === selected.mint) ?? selected
    : null;

  return (
    <section className="home-tape" aria-label="Live markets">
      <form className="home-tape__bar" onSubmit={(event) => void submitSearch(event)}>
        <input
          className="home-tape__search"
          value={query}
          placeholder="Search token, symbol, or mint"
          aria-label="Search tokens"
          enterKeyHint="search"
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void submitSearch();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setLookupError(null);
          }}
        />
        <button type="submit" className="home-tape__tab" disabled={lookupBusy || !query.trim()}>
          {lookupBusy ? "Searching…" : "Search"}
        </button>
        <p className="home-tape__wallet">
          {dash.connected ? "Live" : dash.source === "live" ? "Synced" : "Cached"}
          {dash.walletSol != null ? ` · ${dash.walletSol.toFixed(3)} SOL` : ""}
        </p>
      </form>
      {lookupError ? (
        <p className="home-tape__empty" role="alert">
          {lookupError}
        </p>
      ) : null}
      <div className="home-tape__tabs" role="tablist">
        {(
          [
            ["watch", "Watchlist"],
            ["trending", "Trending"],
            ["new", "New"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`home-tape__tab${tab === id ? " is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="home-tape__list">
        {rows.length ? (
          rows.map((token) => (
            <li key={token.mint}>
              <button type="button" className="home-tape__row" onClick={() => openToken(token)}>
                <span className="home-tape__symbol">
                  {token.symbol}
                  <small>{token.name}</small>
                </span>
                <span className="home-tape__price">{money(token.priceUsd)}</span>
                <span className={token.change24hPct >= 0 ? "home-tape__up" : "home-tape__down"}>
                  {token.change24hPct >= 0 ? "+" : ""}
                  {token.change24hPct.toFixed(1)}%
                </span>
                <span className={`home-tape__score home-tape__score--${token.risk.toLowerCase()}`}>
                  {token.safetyScore}
                </span>
              </button>
            </li>
          ))
        ) : (
          <li className="home-tape__empty">No tokens on this list yet.</li>
        )}
      </ul>

      {liveSelected ? (
        <div className="home-tape__panel" role="dialog" aria-label={`${liveSelected.symbol} detail`}>
          <div className="home-tape__panel-card">
            <header>
              <div>
                <strong>{liveSelected.symbol}</strong>
                <span>{liveSelected.name}</span>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close">
                Close
              </button>
            </header>
            <p className="home-tape__panel-price">
              {money(liveSelected.priceUsd)}
              {prevPrice != null && prevPrice !== liveSelected.priceUsd ? " · updated" : ""}
            </p>
            <ul>
              <li>Safety {liveSelected.safetyScore}/100 · {liveSelected.risk}</li>
              <li>Mkt cap {money(liveSelected.marketCapUsd)}</li>
              <li>Liquidity {money(liveSelected.liquidityUsd)}</li>
            </ul>
            <div className="home-tape__actions">
              <button type="button" onClick={() => openToken(liveSelected)}>
                Analyze
              </button>
              <button type="button" onClick={() => toggleWatch(liveSelected)}>
                {watchIds.includes(liveSelected.id) ? "Unwatch" : "Watch"}
              </button>
              {trading ? (
                <>
                  <Link to={tradePath({ mint: liveSelected.mint, side: "buy" })}>Buy</Link>
                  <Link to={tradePath({ mint: liveSelected.mint, side: "sell" })}>Sell</Link>
                  <Link to={tradePath({ mint: liveSelected.mint })}>Swap</Link>
                </>
              ) : null}
            </div>
            <p className="home-tape__hera">{hera || "Hera is reading this token…"}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
