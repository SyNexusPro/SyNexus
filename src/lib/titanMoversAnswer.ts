import type { MoverTimeframe } from "./moverTimeframes";
import { MOVER_TIMEFRAME_LABEL } from "./moverTimeframes";
import type { SolanaMoversBoard, SolanaMoversResult, TokenMover } from "../services/marketDataService";
import { parseMoverTimeframeFromText } from "./moverTimeframes";
import type { Token } from "../data/tokens";

function formatUsd(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(6)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function parseMoverCount(text: string): number {
  const match = text.match(/\b(top|best|leading|biggest|highest)\s+(\d{1,2})\b/i);
  if (match?.[2]) return Math.min(10, Math.max(1, Number(match[2])));
  const reverse = text.match(/\b(\d{1,2})\s+(best|top|biggest|gainers?|losers?|movers?)\b/i);
  if (reverse?.[1]) return Math.min(10, Math.max(1, Number(reverse[1])));
  return 5;
}

function wantsLosers(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(loser|losers|dump|dumping|bleed|bleeding|down|falling|declin)\b/.test(lower);
}

function formatMoverLine(mover: TokenMover, index: number): string {
  const liq = mover.liquidityUsd != null ? ` · liq ${formatUsd(mover.liquidityUsd)}` : "";
  return `${index + 1}. ${mover.symbol} (${mover.name}) — ${formatPct(mover.changePct)} · ${formatUsd(mover.priceUsd)}${liq}`;
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
  operatorName: string,
): string {
  const timeframe = parseMoverTimeframeFromText(text);
  const slice = board[timeframe];
  if (!slice) return "";

  const count = parseMoverCount(text);
  const losers = wantsLosers(text);
  const list = (losers ? slice.losers : slice.gainers).slice(0, count);
  const label = MOVER_TIMEFRAME_LABEL[timeframe];
  const kind = losers ? "losers" : "gainers";
  const sourceNote = slice.source === "live" ? "DexScreener + Birdeye" : "demo data";

  if (!list.length) {
    return `No clear ${kind} in the ${label} window right now, ${operatorName}. Liquidity filters may have trimmed thin pairs — try 24h or ask me to widen the scan.`;
  }

  const lines = list.map((m, i) => formatMoverLine(m, i));
  const header = `Top ${list.length} Solana ${kind} — ${label} (${sourceNote}):`;

  return `${header}\n${lines.join("\n")}\n\nPulse lane leaders — verify Aegis before you sign.`;
}

/** Instant movers from the in-memory live pool (no Dex/Birdeye round-trip). */
export function formatLocalPoolMoversAnswer(
  text: string,
  tokens: Token[],
  operatorName: string,
): string | null {
  if (!tokens.length) return null;

  const count = parseMoverCount(text);
  const losers = wantsLosers(text);
  const sorted = [...tokens].sort((a, b) =>
    losers ? a.change24hPct - b.change24hPct : b.change24hPct - a.change24hPct,
  );
  const list = sorted.slice(0, count);
  const kind = losers ? "losers" : "gainers";
  const lines = list.map(
    (t, i) =>
      `${i + 1}. ${t.symbol} (${t.name}) — ${formatPct(t.change24hPct)} · ${formatUsd(t.priceUsd)} · liq ${formatUsd(t.liquidityUsd)}`,
  );

  return `Top ${list.length} Solana ${kind} — live pool (instant), ${operatorName}:\n${lines.join("\n")}\n\nFull ${parseMoverTimeframeFromText(text)} board may still be syncing — this is your fastest read.`;
}

/** Compact brief for Titan LLM context — all timeframes. */
export function buildTitanMoversBrief(board: SolanaMoversBoard | null | undefined): string | null {
  if (!board) return null;

  const sections: string[] = [];
  for (const tf of ["5m", "24h", "7d", "30d", "365d"] as MoverTimeframe[]) {
    const slice = board[tf];
    if (!slice?.gainers.length) continue;
    const top = slice.gainers
      .slice(0, 5)
      .map((m) => `${m.symbol}${formatPct(m.changePct)}`)
      .join(", ");
    sections.push(`${MOVER_TIMEFRAME_LABEL[tf]} gainers: ${top} [${slice.source}]`);
  }

  return sections.length ? sections.join("\n") : null;
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
