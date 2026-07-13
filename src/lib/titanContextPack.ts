import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";
import type { TitanMemoryProfile } from "./titanMemory";
import type { OracleConversationContext } from "./oracleSupremeConversation";
import {
  buildAllOracleDirectives,
  buildTokenIntelBrief,
  resolveOracleTokenQuery,
  searchOracleTokens,
} from "./oracleCryptoBrain";
import { buildOperatorStrengthBrief } from "./titanOperatorBrief";

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

export type TitanIntent =
  | "trade_decision"
  | "comparison"
  | "token_lookup"
  | "strategy"
  | "life_counsel"
  | "explain"
  | "general";

/** Lightweight intent tag so the LLM picks the right reasoning mode. */
export function classifyTitanIntent(text: string): TitanIntent {
  const lower = text.toLowerCase().trim();
  if (/should i (buy|sell|ape|exit|hold)|worth (buying|it)|good entry|take profit|cut loss/.test(lower)) {
    return "trade_decision";
  }
  if (/compare|versus|\bvs\b|better between|which one|or \w+\?/.test(lower)) return "comparison";
  if (/^(scan|find|look up|lookup|what is|tell me about)\b|\$[a-z]{2,12}\b/i.test(text)) return "token_lookup";
  if (/strategy|portfolio|allocate|position size|diversify|risk manage/.test(lower)) return "strategy";
  if (/feel|stress|anxious|relationship|life|sleep|work|lonely|overwhelm/.test(lower)) return "life_counsel";
  if (/^why\b|^how does|^explain|^what happens/.test(lower)) return "explain";
  return "general";
}

function tokenMentionedInText(token: Token, text: string): boolean {
  const sym = token.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\$?${sym}\\b`, "i").test(text);
}

function resolveMultiTokenIntel(message: string, tokens: Token[]): string | null {
  const mentioned = tokens.filter((t) => tokenMentionedInText(t, message));
  if (mentioned.length >= 2) {
    return mentioned
      .slice(0, 4)
      .map((t) => buildTokenIntelBrief(t))
      .join("\n---\n");
  }

  const single = resolveOracleTokenQuery(message, tokens);
  if (single) return buildTokenIntelBrief(single);

  const comparisonMatch = message.match(/\b([A-Za-z]{2,12})\b.*\b(vs|versus|or)\b.*\b([A-Za-z]{2,12})\b/i);
  if (comparisonMatch) {
    const left = searchOracleTokens(comparisonMatch[1] ?? "", tokens)[0];
    const right = searchOracleTokens(comparisonMatch[3] ?? "", tokens)[0];
    if (left && right) {
      return `${buildTokenIntelBrief(left)}\n---\n${buildTokenIntelBrief(right)}`;
    }
  }

  return null;
}

/** Sentinel lane orders — gives Titan tactical context beyond symbol names. */
export function buildTitanSentinelBrief(tokens: Token[]): string {
  if (!tokens.length) return "Sentinels on standby — no live targets yet.";
  const dirs = buildAllOracleDirectives(tokens);
  return (["aegis", "pulse", "titan", "cipher"] as const)
    .map((lane) => {
      const d = dirs[lane];
      const target = d.targetSymbol ? ` → ${d.targetSymbol}` : "";
      return `${lane.charAt(0).toUpperCase() + lane.slice(1)}${target}: ${d.order}`;
    })
    .join("\n");
}

/** Watchlist symbols matched against the live pool. */
export function buildTitanWatchlistBrief(symbols: string[], tokens: Token[]): string | null {
  if (!symbols.length) return null;
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 12);
  const lines: string[] = [`Tracking ${unique.length} watchlist symbol(s): ${unique.join(", ")}`];

  for (const sym of unique) {
    const hit = tokens.find((t) => t.symbol.toUpperCase() === sym) ?? searchOracleTokens(sym, tokens)[0];
    if (hit) {
      lines.push(
        `${hit.symbol}: ${synexusRiskBandLabel(hit.guardianRisk)} ${formatPct(hit.change24hPct)} · liq ${formatUsd(hit.liquidityUsd)}`,
      );
    } else {
      lines.push(`${sym}: not in current live pool — say if host wants a manual scan`);
    }
  }

  return lines.join("\n");
}

/** Compact live market snapshot for Titan's system context. */
export function buildTitanMarketBrief(tokens: Token[]): string {
  if (!tokens.length) return "Market feed: still syncing — no live pairs yet.";

  const dangerTokens = tokens.filter((t) => t.guardianRisk === "DANGER");
  const warningTokens = tokens.filter((t) => t.guardianRisk === "WARNING");
  const dangerList = dangerTokens.slice(0, 6);
  const warningList = warningTokens.slice(0, 4);
  const sorted = [...tokens].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct));
  const movers = sorted.slice(0, 12).map(
    (t) =>
      `${t.symbol}: ${synexusRiskBandLabel(t.guardianRisk)} ${formatPct(t.change24hPct)} liq${formatUsd(t.liquidityUsd)}${t.riskScore != null ? ` r${t.riskScore}` : ""}`,
  );

  const safest = [...tokens]
    .filter((t) => t.guardianRisk === "SAFE" && (t.liquidityUsd ?? 0) > 0)
    .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))[0];
  const riskiest = [...tokens].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))[0];

  const sections = [
    `${tokens.length} pairs · ${dangerTokens.length} danger · ${warningTokens.length} warning`,
    dangerList.length
      ? `Danger zone: ${dangerList.map((t) => `${t.symbol}(${t.riskScore ?? "?"})`).join(", ")}`
      : null,
    warningList.length ? `Warnings: ${warningList.map((t) => t.symbol).join(", ")}` : null,
    safest ? `Highest-liquidity safe: ${safest.symbol} liq${formatUsd(safest.liquidityUsd)}` : null,
    riskiest ? `Highest risk score: ${riskiest.symbol} r${riskiest.riskScore ?? "?"}` : null,
    `Top movers: ${movers.join(" | ")}`,
  ].filter(Boolean);

  return sections.join("\n");
}

export function resolveTitanTokenIntel(message: string, tokens: Token[]): string | null {
  return resolveMultiTokenIntel(message, tokens);
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
  operatorBrief?: string | null;
  sentinelBrief?: string | null;
  watchlistBrief?: string | null;
  intentHint?: TitanIntent | null;
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
    operatorBrief: buildOperatorStrengthBrief(ctx),
    sentinelBrief: buildTitanSentinelBrief(ctx.tokens),
    watchlistBrief: buildTitanWatchlistBrief(ctx.watchlistSymbols ?? [], ctx.tokens),
    intentHint: classifyTitanIntent(message),
    tokenIntel: resolveTitanTokenIntel(message, ctx.tokens),
    memory: memory
      ? {
          favoriteSymbols: memory.favoriteSymbols,
          riskTolerance: memory.riskTolerance,
          tradingNotes: memory.tradingNotes,
        }
      : null,
    history: history.slice(-10),
  };
}
