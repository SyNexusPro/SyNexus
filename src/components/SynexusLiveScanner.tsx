import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";

type Props = {
  tokens: Token[];
  feedSource: "live" | "mock";
  dexLiveCount: number;
  loading: boolean;
  error: string | null;
};

const SENTINEL_LANES = [
  { id: "aegis", label: "Aegis", role: "Risk", pro: false },
  { id: "pulse", label: "Pulse", role: "Momentum", pro: false },
  { id: "titan", label: "Titan", role: "Whales", pro: true },
  { id: "cipher", label: "Cipher", role: "Patterns", pro: true },
] as const;

function laneStatus(token: Token, laneId: (typeof SENTINEL_LANES)[number]["id"]): string {
  switch (laneId) {
    case "aegis":
      return synexusRiskBandLabel(token.guardianRisk);
    case "pulse":
      return token.change24hPct >= 0
        ? `+${token.change24hPct.toFixed(1)}% 24h`
        : `${token.change24hPct.toFixed(1)}% 24h`;
    case "titan":
      return token.topWalletPct != null ? `Top ${token.topWalletPct}%` : "Tracking…";
    case "cipher":
      return token.riskScore != null ? `Score ${token.riskScore}` : "Analyzing…";
    default:
      return "—";
  }
}

function riskClass(risk: Token["guardianRisk"]): string {
  if (risk === "DANGER") return "synexus-scanner__risk--danger";
  if (risk === "WARNING") return "synexus-scanner__risk--warning";
  return "synexus-scanner__risk--safe";
}

export function SynexusLiveScanner({ tokens, feedSource, dexLiveCount, loading, error }: Props) {
  const [scanIndex, setScanIndex] = useState(0);
  const [tick, setTick] = useState(0);

  const scanQueue = useMemo(() => (tokens.length ? tokens : []).slice(0, 12), [tokens]);
  const active = scanQueue[scanIndex % Math.max(scanQueue.length, 1)];

  useEffect(() => {
    if (!scanQueue.length) return;
    const id = window.setInterval(() => {
      setScanIndex((i) => (i + 1) % scanQueue.length);
      setTick((t) => t + 1);
    }, 2200);
    return () => window.clearInterval(id);
  }, [scanQueue.length]);

  const sourceLabel = feedSource === "live" ? "DexScreener · Live feed" : "Sample feed";

  return (
    <section className="synexus-scanner" aria-label="Live market scanner">
      <div className="synexus-scanner__scanline" aria-hidden />

      <header className="synexus-scanner__head">
        <div className="synexus-scanner__status">
          <span className="synexus-scanner__pulse" aria-hidden />
          <span>{loading ? "Initializing scan…" : "Scanning"}</span>
        </div>
        <span className="synexus-scanner__source">{sourceLabel}</span>
      </header>

      <div className="synexus-scanner__viewport" key={active ? `${active.id}-${tick}` : "empty"}>
        {active ? (
          <>
            <div className="synexus-scanner__token">
              <span className="synexus-scanner__symbol">{active.symbol}</span>
              <span className="synexus-scanner__name">{active.name}</span>
              <span className={`synexus-scanner__risk ${riskClass(active.guardianRisk)}`}>
                {synexusRiskBandLabel(active.guardianRisk)}
              </span>
            </div>

            <ul className="synexus-scanner__lanes">
              {SENTINEL_LANES.map((lane, laneIndex) => {
                const locked = lane.pro;
                const stagger = laneIndex * 0.12;
                return (
                  <li
                    key={lane.id}
                    className={`synexus-scanner__lane${locked ? " synexus-scanner__lane--pro" : ""}`}
                    style={{ animationDelay: `${stagger}s` }}
                  >
                    <span className="synexus-scanner__lane-label">{lane.label}</span>
                    <span className="synexus-scanner__lane-role">{lane.role}</span>
                    <div className="synexus-scanner__lane-bar" aria-hidden>
                      <span
                        className="synexus-scanner__lane-fill"
                        style={{ animationDelay: `${stagger}s` }}
                      />
                    </div>
                    {locked ? (
                      <span className="synexus-scanner__lane-lock">Pro</span>
                    ) : (
                      <span className="synexus-scanner__lane-value">{laneStatus(active, lane.id)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="synexus-scanner__empty">Waiting for market pairs…</p>
        )}
      </div>

      <footer className="synexus-scanner__foot">
        <p className="synexus-scanner__meta">
          {feedSource === "live"
            ? `${dexLiveCount} pair${dexLiveCount === 1 ? "" : "s"} synced from DexScreener`
            : "Preview mode — connect live feed in production"}
        </p>
        <Link className="synexus-scanner__pro-cta" to="/pulse#synexus-pro">
          Full Sentinel scans on Synexus Pro →
        </Link>
        {error ? <p className="synexus-scanner__error">{error}</p> : null}
      </footer>
    </section>
  );
}
