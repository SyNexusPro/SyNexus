import type { MoverTimeframe } from "./moverTimeframes";
import { MOVER_TIMEFRAME_LABEL } from "./moverTimeframes";
import type { SolanaMoversBoard, SolanaMoversResult } from "../services/marketDataService";
import { parseMoverTimeframeFromText } from "./moverTimeframes";
import type { Token } from "../data/tokens";
import { heraDataAsOfLine, heraRankReason } from "./hera/formatLiveStamp";

function formatUsd(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(6)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function parseMoverCount(text: string): number {
  const match = text.match(/\b(top|best|leading|biggest|highest)\s+(\d{1,2})\b/i);
  if (match?.[2]) return Math.min(10, Math.max(1, Number(match[2])));
  const reverse = text.match(/\b(\d{1,2})\s+(best|top|biggest|gainers?|losers?|movers?)\b/i);
  if (reverse?.[1]) return Math.min(10, Math.max(1, Number(reverse[1])));
  return 3;
}

function wantsLosers(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(loser|losers|dump|dumping|bleed|bleeding|down|falling|declin)\b/.test(lower);
}

export function formatTopMoversAnswerFromResult(
  text: string,
  slice: SolanaMoversResult,
  operatorName: string,
): string {
  const timeframe = parseMoverTimeframeFromText(text);
  const board = { [timeframe]: slice } as SolanaMoversBoard;
  return formatTopMoversAnswer(text, board, operatorName);
}

export function formatTopMoversAnswer(
  text: string,
  board: SolanaMoversBoard,
  _operatorName: string,
): string {
  const timeframe = parseMoverTimeframeFromText(text);
  const slice = board[timeframe];
  if (!slice) return "";

  const count = Math.min(5, parseMoverCount(text));
  const losers = wantsLosers(text);
  const list = (losers ? slice.losers : slice.gainers).slice(0, count);
  const label = MOVER_TIMEFRAME_LABEL[timeframe];
  const sourceNote = slice.source === "live" ? "live markets" : "demo data";

  if (!list.length) {
    return `I don't have a clean ${losers ? "losers" : "leaders"} list for ${label} right now. Live filters may have trimmed thin pairs — try 24h or ask me to widen the scan.\n\n${heraDataAsOfLine(slice.updatedAt, sourceNote)}`;
  }

  const lines = list.map((m, i) => {
    const why = heraRankReason({
      index: i,
      changePct: m.changePct,
      volumeUsd: undefined,
      liquidityUsd: m.liquidityUsd,
      losers,
    });
    const nameBit = m.name && m.name !== m.symbol ? ` ${m.name}` : "";
    return `${i + 1}. $${m.symbol}${nameBit} (${formatPct(m.changePct)}) — ${why}`;
  });

  const opener = losers
    ? `Here are the weakest prints on the ${label} board right now based on momentum and volume:`
    : `Here are the top performing tokens right now based on momentum, volume, liquidity, and safety score (${label}):`;

  return `${opener}\n\n${lines.join("\n")}\n\n${heraDataAsOfLine(slice.updatedAt, sourceNote)}`;
}

/** Instant movers from the in-memory live pool (no Dex/Birdeye round-trip). */
export function formatLocalPoolMoversAnswer(
  text: string,
  tokens: Token[],
  _operatorName: string,
): string | null {
  if (!tokens.length) return null;

  const count = parseMoverCount(text);
  const losers = wantsLosers(text);
  const sorted = [...tokens].sort((a, b) =>
    losers ? a.change24hPct - b.change24hPct : b.change24hPct - a.change24hPct,
  );
  const list = sorted.slice(0, count);
  const lines = list.map((t, i) => {
    const why = heraRankReason({
      index: i,
      changePct: t.change24hPct,
      volumeUsd: t.volume24hUsd,
      liquidityUsd: t.liquidityUsd,
      losers,
    });
    return `${i + 1}. $${t.symbol}${t.name ? ` ${t.name}` : ""} (${formatPct(t.change24hPct)}) — ${why}`;
  });

  const opener = losers
    ? `Here are the softest prints from the live pool right now:`
    : `Here are the top performing tokens right now based on momentum, volume, liquidity, and safety score:`;

  return `${opener}\n\n${lines.join("\n")}\n\n${heraDataAsOfLine(new Date(), "live pool")}`;
}

/** Compact brief for Titan LLM context — all timeframes. */
export function buildTitanMoversBrief(board: SolanaMoversBoard | null | undefined): string | null {
  if (!board) return null;

  const sections: string[] = [];
  let newest = 0;
  for (const tf of ["5m", "24h", "7d", "30d", "365d"] as MoverTimeframe[]) {
    const slice = board[tf];
    if (!slice?.gainers.length) continue;
    newest = Math.max(newest, slice.updatedAt || 0);
    const top = slice.gainers
      .slice(0, 5)
      .map((m) => `${m.symbol}${formatPct(m.changePct)}`)
      .join(", ");
    sections.push(`${MOVER_TIMEFRAME_LABEL[tf]} gainers: ${top} [${slice.source}]`);
  }

  if (!sections.length) return null;
  if (newest) sections.unshift(heraDataAsOfLine(newest, "movers board"));
  return sections.join("\n");
}

export function buildTitanMoversBriefForTimeframe(result: SolanaMoversResult): string {
  const label = MOVER_TIMEFRAME_LABEL[result.timeframe];
  const gainers = result.gainers
    .slice(0, 5)
    .map((m) => `${m.symbol} ${formatPct(m.changePct)} liq${formatUsd(m.liquidityUsd)}`)
    .join(" | ");
  const losers = result.losers
    .slice(0, 3)
    .map((m) => `${m.symbol} ${formatPct(m.changePct)}`)
    .join(" | ");
  return `${label} · source ${result.source}\nGainers: ${gainers || "—"}\nLosers: ${losers || "—"}`;
}
