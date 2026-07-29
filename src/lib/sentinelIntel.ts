import type { Token } from "../data/tokens";
import type { SyntheticSentinel } from "../data/syntheticWatchers";
import {
  SENTINEL_LANES,
  normalizeSentinelLaneId,
  type SentinelLaneId,
} from "../config/sentinels";
import {
  buildOracleSentinelDirective,
  buildSentinelReportToOracle,
  type OracleSentinelDirective,
} from "./oracleCryptoBrain";

export type { SentinelLaneId } from "../config/sentinels";
export { normalizeSentinelLaneId } from "../config/sentinels";

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
  const leviathanSentinel = sentinelById(sentinels, "leviathan");
  const cipherSentinel = sentinelById(sentinels, "cipher");

  const baseScans = Math.max(48, pool.length * 14 + sentinelAlerts.length * 6);

  const aegisFocus = danger[0] ?? warning[0] ?? null;
  const pulseFocus = movers[0] ?? null;
  const leviathanFocus = whales[0] ?? null;
  const cipherFocus = fused[0] ?? danger[0] ?? movers[0] ?? null;

  const aegisHits = danger.length + warning.length;
  const pulseHits = movers.length;
  const leviathanHits = whales.length;
  const cipherHits = fused.length;

  function computeStats(sentinel: SyntheticSentinel | undefined, hits: number, scansBoost: number) {
    const level = sentinel?.level ?? 1;
    const confidence = sentinel?.confidence ?? 70;
    const lanePro = sentinel?.laneId ? SENTINEL_LANES[sentinel.laneId].proPrecisionBoost : false;
    return {
      precision: Math.min(99, confidence + (pro && lanePro ? 6 : pro ? 3 : 0) + Math.min(6, hits)),
      responseMs: Math.max(32, Math.round(140 - level * 14 - (pro ? 24 : 0) - Math.min(20, hits * 2))),
      scansPerMin: baseScans + scansBoost + level * 12 + (pro ? 44 : 0),
      hits,
    };
  }

  const aegisStats = computeStats(aegisSentinel, aegisHits, 22);
  const pulseStats = computeStats(pulseSentinel, pulseHits, 30);
  const leviathanStats = computeStats(leviathanSentinel, leviathanHits, 18);
  const cipherStats = computeStats(cipherSentinel, cipherHits, 24);

  const aegisStatus =
    pool.length === 0
      ? SENTINEL_LANES.aegis.idleStatus
      : aegisHits > 0
        ? `${aegisHits} security hit${aegisHits === 1 ? "" : "s"} · ${danger.length} danger · ${warning.length} warning${aegisFocus ? ` · focus ${aegisFocus.symbol}` : ""}`
        : `Security lane clear on ${pool.length} pair${pool.length === 1 ? "" : "s"} — contracts, liquidity, and rug heuristics green.`;

  const pulseStatus =
    pool.length === 0
      ? SENTINEL_LANES.pulse.idleStatus
      : pulseFocus
        ? `${pulseFocus.symbol} ${formatPct(pulseFocus.change24hPct)} 24h · ${pulseHits} mover${pulseHits === 1 ? "" : "s"} · volume cross-checked`
        : `No major breakouts — monitoring ${pool.length} pair${pool.length === 1 ? "" : "s"} for integrity.`;

  const leviathanStatus =
    pool.length === 0
      ? SENTINEL_LANES.leviathan.idleStatus
      : leviathanFocus
        ? `${leviathanFocus.symbol} top holder ${leviathanFocus.topWalletPct ?? "?"}% · ${leviathanHits} concentration flag${leviathanHits === 1 ? "" : "s"}`
        : `Whale lanes calm across ${pool.length} pair${pool.length === 1 ? "" : "s"}.`;

  const cipherStatus =
    pool.length === 0
      ? SENTINEL_LANES.cipher.idleStatus
      : cipherFocus
        ? `${cipherHits} multi-lane match${cipherHits === 1 ? "" : "es"} · ${cipherFocus.symbol} stacked across lanes`
        : `Patterns quiet — cross-checking ${pool.length} pair${pool.length === 1 ? "" : "s"}.`;

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

  const out = {} as Record<SentinelLaneId, SentinelLiveIntel>;
  out.aegis = laneIntel("aegis", aegisFocus, aegisStats, aegisStatus, aegisHits, aegisSentinel);
  out.pulse = laneIntel("pulse", pulseFocus, pulseStats, pulseStatus, pulseHits, pulseSentinel);
  out.leviathan = laneIntel(
    "leviathan",
    leviathanFocus,
    leviathanStats,
    leviathanStatus,
    leviathanHits,
    leviathanSentinel,
  );
  out.cipher = laneIntel("cipher", cipherFocus, cipherStats, cipherStatus, cipherHits, cipherSentinel);
  return out;
}

export function sentinelLaneIdFromSentinel(sentinelId: string): SentinelLaneId | null {
  return normalizeSentinelLaneId(sentinelId);
}
