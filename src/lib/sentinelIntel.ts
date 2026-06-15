import type { Token } from "../data/tokens";
import type { SyntheticSentinel } from "../data/syntheticWatchers";
import {
  buildOracleSentinelDirective,
  buildSentinelReportToOracle,
  type OracleSentinelDirective,
} from "./oracleCryptoBrain";

export type SentinelLaneId = "aegis" | "pulse" | "titan" | "cipher";

export type SentinelLiveIntel = {
  liveStatus: string;
  precision: number;
  responseMs: number;
  scansPerMin: number;
  focusSymbol: string | null;
  hits: number;
  oracleDirective: string;
  sentinelReport: string;
  reportMs: number;
};

type AlertItem = {
  tokenSymbol: string;
  severity: "WARNING" | "DANGER";
};

type BuildIntelInput = {
  sentinels: SyntheticSentinel[];
  tokens: Token[];
  sentinelAlerts: AlertItem[];
  plan: "FREE" | "PRO";
};

function sentinelById(sentinels: SyntheticSentinel[], id: SentinelLaneId) {
  return sentinels.find((s) => s.id === id);
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function buildSentinelLiveIntel({
  sentinels,
  tokens,
  sentinelAlerts,
  plan,
}: BuildIntelInput): Record<SentinelLaneId, SentinelLiveIntel> {
  const pro = plan === "PRO";
  const pool = tokens.length ? tokens : [];

  const danger = pool.filter((t) => t.guardianRisk === "DANGER");
  const warning = pool.filter((t) => t.guardianRisk === "WARNING");
  const movers = pool
    .filter((t) => Math.abs(t.change24hPct) >= 8)
    .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct));
  const whales = pool
    .filter((t) => (t.topWalletPct ?? 0) >= 18)
    .sort((a, b) => (b.topWalletPct ?? 0) - (a.topWalletPct ?? 0));
  const fused = pool.filter((t) => {
    const laneHits =
      (t.guardianRisk !== "SAFE" ? 1 : 0) +
      (Math.abs(t.change24hPct) >= 10 ? 1 : 0) +
      ((t.topWalletPct ?? 0) >= 22 ? 1 : 0) +
      ((t.riskScore ?? 0) >= 45 ? 1 : 0);
    return laneHits >= 2;
  });

  const aegisSentinel = sentinelById(sentinels, "aegis");
  const pulseSentinel = sentinelById(sentinels, "pulse");
  const titanSentinel = sentinelById(sentinels, "titan");
  const cipherSentinel = sentinelById(sentinels, "cipher");

  const baseScans = Math.max(48, pool.length * 14 + sentinelAlerts.length * 6);

  const aegisFocus = danger[0] ?? warning[0] ?? null;
  const pulseFocus = movers[0] ?? null;
  const titanFocus = whales[0] ?? null;
  const cipherFocus = fused[0] ?? danger[0] ?? movers[0] ?? null;

  const aegisHits = danger.length + warning.length;
  const pulseHits = movers.length;
  const titanHits = whales.length;
  const cipherHits = fused.length;

  function computeStats(sentinel: SyntheticSentinel | undefined, hits: number, scansBoost: number) {
    const level = sentinel?.level ?? 1;
    const confidence = sentinel?.confidence ?? 70;
    return {
      precision: Math.min(99, confidence + (pro ? 4 : 0) + Math.min(6, hits)),
      responseMs: Math.max(38, Math.round(148 - level * 14 - (pro ? 22 : 0) - Math.min(18, hits * 2))),
      scansPerMin: baseScans + scansBoost + level * 12 + (pro ? 40 : 0),
      hits,
    };
  }

  const aegisStats = computeStats(aegisSentinel, aegisHits, 20);
  const pulseStats = computeStats(pulseSentinel, pulseHits, 28);
  const titanStats = computeStats(titanSentinel, titanHits, 16);
  const cipherStats = computeStats(cipherSentinel, cipherHits, 22);

  const aegisStatus =
    pool.length === 0
      ? "Standing by — Aegis will scan your watchlist for rugs and liquidity traps."
      : aegisHits > 0
        ? `${aegisHits} risk hit${aegisHits === 1 ? "" : "s"} · ${danger.length} danger · ${warning.length} warning${aegisFocus ? ` · focus ${aegisFocus.symbol}` : ""}`
        : `All clear on ${pool.length} scanned pair${pool.length === 1 ? "" : "s"} — contract and liquidity lanes green.`;

  const pulseStatus =
    pool.length === 0
      ? "Pulse ready — will separate real momentum from fake pumps."
      : pulseFocus
        ? `${pulseFocus.symbol} ${formatPct(pulseFocus.change24hPct)} 24h · ${pulseHits} mover${pulseHits === 1 ? "" : "s"} tracked · noise filtered`
        : `No major breakouts — monitoring ${pool.length} pair${pool.length === 1 ? "" : "s"} for volume spikes.`;

  const titanStatus =
    pool.length === 0
      ? "Titan watching for whale-sized wallet shifts."
      : titanFocus
        ? `${titanFocus.symbol} top wallet ${titanFocus.topWalletPct ?? "?"}% · ${titanHits} concentration flag${titanHits === 1 ? "" : "s"}`
        : `Whale lanes calm across ${pool.length} pair${pool.length === 1 ? "" : "s"}.`;

  const cipherStatus =
    pool.length === 0
      ? "Cipher correlates weak signals into one precise read."
      : cipherFocus
        ? `${cipherHits} multi-lane match${cipherHits === 1 ? "" : "es"} · ${cipherFocus.symbol} flagged across risk + flow`
        : `Patterns quiet — cross-checking ${pool.length} pair${pool.length === 1 ? "" : "s"} for stacked signals.`;

  function laneIntel(
    lane: SentinelLaneId,
    focus: Token | null,
    laneStats: ReturnType<typeof computeStats>,
    status: string,
    hits: number,
    sentinel: SyntheticSentinel | undefined,
  ) {
    const directive: OracleSentinelDirective = buildOracleSentinelDirective(lane, focus, pool.length);
    const report = buildSentinelReportToOracle(
      lane,
      focus,
      directive.order,
      sentinel?.level ?? 1,
      pro,
    );
    return {
      ...laneStats,
      hits,
      liveStatus: status,
      focusSymbol: focus?.symbol ?? null,
      oracleDirective: directive.order,
      sentinelReport: report.report,
      reportMs: report.latencyMs,
      precision: Math.max(laneStats.precision, report.precision),
      responseMs: Math.min(laneStats.responseMs, report.latencyMs),
    };
  }

  return {
    aegis: laneIntel("aegis", aegisFocus, aegisStats, aegisStatus, aegisHits, aegisSentinel),
    pulse: laneIntel("pulse", pulseFocus, pulseStats, pulseStatus, pulseHits, pulseSentinel),
    titan: laneIntel("titan", titanFocus, titanStats, titanStatus, titanHits, titanSentinel),
    cipher: laneIntel("cipher", cipherFocus, cipherStats, cipherStatus, cipherHits, cipherSentinel),
  };
}

export function sentinelLaneIdFromSentinel(sentinelId: string): SentinelLaneId | null {
  if (sentinelId === "aegis" || sentinelId === "pulse" || sentinelId === "titan" || sentinelId === "cipher") {
    return sentinelId;
  }
  return null;
}
