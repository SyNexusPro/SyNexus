import { getTimeBand } from "./oracleSupremeConversation";
import type { OracleConversationContext } from "./oracleSupremeConversation";
import { buildJournalSummary, getOpenTrades } from "./tradeJournal";

/** Compact operator snapshot so Titan gives stronger, personalized counsel. */
export function buildOperatorStrengthBrief(ctx: OracleConversationContext): string {
  const band = getTimeBand();
  const lines: string[] = [
    `Local time band: ${band}`,
    ctx.daysSinceLastVisit > 0 ? `Away ${ctx.daysSinceLastVisit} day(s) since last session` : "Active session",
  ];

  if (ctx.alertCount > 0) {
    lines.push(`${ctx.alertCount} live Sentinel alert(s) need attention`);
  }
  if (ctx.watchlistCount > 0) {
    lines.push(`Watchlist: ${ctx.watchlistCount} token(s) tracked`);
  }

  try {
    const journal = buildJournalSummary();
    if (journal.total > 0) {
      lines.push(
        `Trade journal: ${journal.total} trades · ${journal.open} open · win rate ${journal.winRatePct.toFixed(0)}% · net P/L ${journal.totalProfitLossUsd >= 0 ? "+" : ""}$${journal.totalProfitLossUsd.toFixed(2)}`,
      );
      const openSymbols = getOpenTrades()
        .slice(0, 4)
        .map((t) => t.symbol)
        .join(", ");
      if (openSymbols) lines.push(`Open positions: ${openSymbols}`);
    }
  } catch {
    /* journal optional */
  }

  return lines.join("\n");
}
