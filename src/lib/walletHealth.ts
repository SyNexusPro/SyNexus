import type { Token } from "../data/tokens";
import {
  buildJournalSummary,
  getClosedTrades,
  getTradeJournal,
  logTradeFromToken,
  type TradeRecord,
} from "./tradeJournal";

const VIEWS_KEY = "synexus_token_views";

export type WalletHealthReport = {
  totalTrades: number;
  openTrades: number;
  buys: number;
  sells: number;
  wins: number;
  losses: number;
  winRatePct: number;
  totalProfitLossUsd: number;
  bestTrade: TradeRecord | null;
  worstTrade: TradeRecord | null;
  avgRiskScore: number;
  dangerTradePct: number;
  riskHabits: string[];
  suggestions: string[];
  hasData: boolean;
};

export function logTradeIntent(token: Token, side: "buy" | "sell", usdEstimate = 100) {
  return logTradeFromToken(token, side, usdEstimate);
}

export function recordTokenView(token: Token) {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[token.symbol] = (map[token.symbol] ?? 0) + 1;
    localStorage.setItem(VIEWS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function buildWalletHealthReport(): WalletHealthReport {
  const summary = buildJournalSummary();
  const closed = getClosedTrades();
  const withPnl = closed.filter((r) => r.profitLossPct != null);

  const bestTrade =
    withPnl.length > 0
      ? withPnl.reduce((a, b) => ((a.profitLossPct ?? 0) > (b.profitLossPct ?? 0) ? a : b))
      : null;
  const worstTrade =
    withPnl.length > 0
      ? withPnl.reduce((a, b) => ((a.profitLossPct ?? 0) < (b.profitLossPct ?? 0) ? a : b))
      : null;

  const allRecords = getTradeJournal();
  const dangerTrades = allRecords.filter(
    (e) => e.entryGuardianRisk === "DANGER" || e.entryRiskScore >= 60,
  );
  const dangerTradePct = summary.total
    ? Math.round((dangerTrades.length / summary.total) * 100)
    : 0;

  const riskHabits: string[] = [];
  const suggestions: string[] = [];

  if (summary.total === 0) {
    riskHabits.push("No trades logged yet — Synexus auto-tracks when you tap Buy or Sell.");
    suggestions.push("Run Should I buy? before your next entry, then trade from a token page.");
  } else {
    if (dangerTradePct >= 40) {
      riskHabits.push(`You chase high-risk setups ${dangerTradePct}% of the time.`);
      suggestions.push("Wait for Warning or Safe Sentinel bands before sizing up.");
    } else if (dangerTradePct >= 20) {
      riskHabits.push("You occasionally trade elevated-risk tokens.");
      suggestions.push("Set a max risk score (e.g. 45) before every buy.");
    } else {
      riskHabits.push("You mostly respect Sentinel risk bands — good discipline.");
    }

    if (summary.avgRiskScore >= 50) {
      suggestions.push("Average entry risk is high — filter feed to Safer tokens first.");
    }

    if (summary.open > 0 && summary.closed === 0) {
      riskHabits.push(`${summary.open} open position${summary.open > 1 ? "s" : ""} — no exits logged yet.`);
      suggestions.push("Tap Sell when you exit so Synexus can calculate profit and loss.");
    }

    if (summary.wins + summary.losses >= 3 && summary.winRatePct < 45) {
      suggestions.push("Win rate is below 45% — tighten entries to Safe band only for 7 days.");
    }

    if (summary.totalProfitLossUsd < -50) {
      suggestions.push("Journal shows net losses — review notes on your worst trades.");
    }
  }

  if (suggestions.length === 0) {
    suggestions.push("Add notes to journal entries so you remember why you traded.");
  }

  return {
    totalTrades: summary.total,
    openTrades: summary.open,
    buys: summary.total,
    sells: summary.closed,
    wins: summary.wins,
    losses: summary.losses,
    winRatePct: summary.winRatePct,
    totalProfitLossUsd: summary.totalProfitLossUsd,
    bestTrade,
    worstTrade,
    avgRiskScore: summary.avgRiskScore,
    dangerTradePct,
    riskHabits,
    suggestions,
    hasData: summary.total > 0,
  };
}
