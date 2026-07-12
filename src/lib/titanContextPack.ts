import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";
import type { TitanMemoryProfile } from "./titanMemory";
import type { OracleConversationContext } from "./oracleSupremeConversation";
import { buildAllOracleDirectives, buildTokenIntelBrief, resolveOracleTokenQuery } from "./oracleCryptoBrain";

function formatUsd(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(value >= 1 ? 2 : 6)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Compact live market snapshot for Titan's system context. */
export function buildTitanMarketBrief(tokens: Token[]): string {
  if (!tokens.length) return "Market feed: still syncing — no live pairs yet.";

  const sorted = [...tokens].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct));
  const top = sorted.slice(0, 8);
  const lines = top.map(
    (t) =>
      `${t.symbol}: ${synexusRiskBandLabel(t.guardianRisk)} ${formatPct(t.change24hPct)} liq${formatUsd(t.liquidityUsd)}${t.riskScore != null ? ` r${t.riskScore}` : ""}`,
  );

  const danger = tokens.filter((t) => t.guardianRisk === "DANGER").length;
  const warning = tokens.filter((t) => t.guardianRisk === "WARNING").length;
  const dirs = buildAllOracleDirectives(tokens);
  return [
    `${tokens.length} pairs · ${danger} danger · ${warning} warning`,
    `Aegis→${dirs.aegis.targetSymbol ?? "standby"} Pulse→${dirs.pulse.targetSymbol ?? "standby"} Leviathan→${dirs.titan.targetSymbol ?? "standby"}`,
    lines.join(" | "),
  ].join("\n");
}

export function resolveTitanTokenIntel(message: string, tokens: Token[]): string | null {
  const token = resolveOracleTokenQuery(message, tokens);
  if (!token) return null;
  return buildTokenIntelBrief(token);
}

export type TitanChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TitanChatPayload = {
  message: string;
  operatorName: string;
  titanBotName: string;
  plan: "FREE" | "PRO";
  alertCount: number;
  watchlistCount: number;
  feedSource: "live" | "mock";
  marketBrief: string;
  tokenIntel?: string | null;
  memory?: Pick<TitanMemoryProfile, "favoriteSymbols" | "riskTolerance" | "tradingNotes"> | null;
  history: TitanChatHistoryMessage[];
};

export function buildTitanChatPayload(
  message: string,
  ctx: OracleConversationContext,
  history: TitanChatHistoryMessage[],
  memory: TitanMemoryProfile | null,
): TitanChatPayload {
  return {
    message,
    operatorName: ctx.operatorName,
    titanBotName: ctx.titanBotName,
    plan: ctx.plan,
    alertCount: ctx.alertCount,
    watchlistCount: ctx.watchlistCount,
    feedSource: ctx.feedSource,
    marketBrief: buildTitanMarketBrief(ctx.tokens),
    tokenIntel: resolveTitanTokenIntel(message, ctx.tokens),
    memory: memory
      ? {
          favoriteSymbols: memory.favoriteSymbols,
          riskTolerance: memory.riskTolerance,
          tradingNotes: memory.tradingNotes,
        }
      : null,
    history: history.slice(-6),
  };
}
