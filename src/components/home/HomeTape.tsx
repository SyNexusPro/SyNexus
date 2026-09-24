import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isTradingEnabled, tradePath } from "../../config/trading";
import { useSolanaWallet } from "../../hooks/useSolanaWallet";
import { assessSwapToken } from "../../lib/swapSafety";
import { realtime } from "../../lib/realtime/RealtimeManager";
import { useRealtimeDashboard } from "../../lib/realtime/useRealtimeDashboard";
import type { TapeToken } from "../../lib/realtime/types";
import { buildTokenFromPartial } from "../../data/tokens";

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
  const wallet = useSolanaWallet();
  const trading = isTradingEnabled();
  const [tab, setTab] = useState<"watch" | "trending" | "new">("trending");
  const [query, setQuery] = useState("");
  const [watchIds, setWatchIds] = useState<string[]>(() => readWatchIds());
  const [selected, setSelected] = useState<TapeToken | null>(null);
  const [hera, setHera] = useState("");
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const streamRef = useRef(0);

  useEffect(() => () => window.clearInterval(streamRef.current), []);

  useEffect(() => {
    realtime.noteWallet(wallet.address, wallet.snapshot?.sol ?? dash.walletSol);
  }, [wallet.address, wallet.snapshot?.sol, dash.walletSol]);

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
      <div className="home-tape__bar">
        <input
          className="home-tape__search"
          value={query}
          placeholder="Search token, symbol, or mint"
          aria-label="Search tokens"
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="home-tape__wallet">
          {dash.connected ? "Live" : dash.source === "live" ? "Synced" : "Cached"}
          {dash.walletSol != null ? ` · ${dash.walletSol.toFixed(3)} SOL` : ""}
        </p>
      </div>
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
