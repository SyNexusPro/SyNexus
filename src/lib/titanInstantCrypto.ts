import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";
import { analyzeShouldIBuy } from "./shouldIBuy";
import { isTopMoversQuestion } from "./moverTimeframes";
import { formatLocalPoolMoversAnswer, formatTopMoversAnswer } from "./titanMoversAnswer";
import { classifyTitanIntent } from "./titanContextPack";
import {
  answerCryptoConcept,
  buildTokenIntelBrief,
  oracleRespondToMessage,
  resolveOracleTokenQuery,
  searchOracleTokens,
} from "./oracleCryptoBrain";
import { isInstantTitanPath } from "./titanRouting";
import type { OracleConversationContext } from "./oracleSupremeConversation";
import { rememberFavoriteSymbol } from "./titanMemory";

const CRYPTO_TOPIC =
  /\b(solana|sol\b|crypto|token|coin|memecoin|defi|nft|wallet|liquidity|rug|whale|pump|mcap|dex|mint|trade|trading|market|gainer|loser|sentinel|aegis|pulse|leviathan|cipher)\b/i;

const PRICE_QUERY =
  /\b(price|cost|worth|trading at|how much|what'?s .+ at|\$\d|usd)\b/i;

const TRADE_QUERY =
  /\b(should i|worth buying|worth it|good entry|buy|sell|ape|hold|exit|take profit|cut loss|rug|scam)\b/i;

const COMPARE_QUERY = /\b(compare|versus|\bvs\b|better between|which one| or )\b/i;

function looksCrypto(text: string): boolean {
  return CRYPTO_TOPIC.test(text) || /\$[A-Za-z]{2,12}\b/.test(text);
}

/** True when we can answer from live pool data without waiting on the LLM. */
export function isInstantCryptoPath(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isTopMoversQuestion(trimmed) || isInstantTitanPath(trimmed)) return true;

  const intent = classifyTitanIntent(trimmed);
  if (intent === "life_counsel") return false;
  if (intent === "general" && !looksCrypto(trimmed)) return false;

  return (
    intent === "trade_decision" ||
    intent === "comparison" ||
    intent === "token_lookup" ||
    intent === "strategy" ||
    intent === "explain" ||
    intent === "market_movers" ||
    looksCrypto(trimmed)
  );
}

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

function instantTradeRead(token: Token, operatorName: string): string {
  const read = analyzeShouldIBuy(token);
  const stance =
    read.verdict === "AVOID"
      ? "Avoid"
      : read.verdict === "HIGH_RISK"
        ? "High risk"
        : read.verdict === "WATCH"
          ? "Watch"
          : "OK";
  return [
    `${stance} · ${token.symbol} — ${read.headline}`,
    read.explanation,
    `Live: ${formatUsd(token.priceUsd)} · 24h ${formatPct(token.change24hPct)} · liq ${formatUsd(token.liquidityUsd)}`,
    `Sentinel: ${token.guardianMessage}`,
    `That's my read, ${operatorName} — you sign every swap.`,
  ].join("\n");
}

function instantPriceRead(token: Token): string {
  return `${token.symbol}: ${formatUsd(token.priceUsd)} · 24h ${formatPct(token.change24hPct)}${
    token.priceMove1hPct != null ? ` · 1h ${formatPct(token.priceMove1hPct)}` : ""
  } · liq ${formatUsd(token.liquidityUsd)} · ${synexusRiskBandLabel(token.guardianRisk)} band`;
}

function instantComparison(text: string, tokens: Token[]): string | null {
  const match = text.match(/\b([A-Za-z]{2,12})\b.*\b(vs|versus|or)\b.*\b([A-Za-z]{2,12})\b/i);
  if (!match) return null;
  const left = searchOracleTokens(match[1] ?? "", tokens)[0];
  const right = searchOracleTokens(match[3] ?? "", tokens)[0];
  if (!left || !right) return null;

  const leftRead = analyzeShouldIBuy(left);
  const rightRead = analyzeShouldIBuy(right);
  const rank = (v: typeof leftRead.verdict) =>
    v === "AVOID" ? 0 : v === "HIGH_RISK" ? 1 : v === "WATCH" ? 2 : 3;
  const winner = rank(leftRead.verdict) === rank(rightRead.verdict)
    ? left.riskScore != null && right.riskScore != null && left.riskScore !== right.riskScore
      ? left.riskScore < right.riskScore
        ? left
        : right
      : null
    : rank(leftRead.verdict) > rank(rightRead.verdict)
      ? left
      : right;

  const lines = [
    `${left.symbol}: ${leftRead.headline} · r${left.riskScore ?? "?"} · liq ${formatUsd(left.liquidityUsd)}`,
    `${right.symbol}: ${rightRead.headline} · r${right.riskScore ?? "?"} · liq ${formatUsd(right.liquidityUsd)}`,
  ];
  if (winner) {
    lines.push(`Edge: ${winner.symbol} — cleaner Sentinel read for most hosts.`);
  } else {
    lines.push("Edge: tie on band — pick the one with deeper liquidity and a mint you verified.");
  }
  return lines.join("\n");
}

function instantTokenBrief(token: Token, operatorName: string): string {
  rememberFavoriteSymbol(token.symbol);
  return `${token.symbol} — live read:\n${buildTokenIntelBrief(token)}\n\nAsk me for a one-line verdict on ${token.symbol}, ${operatorName}.`;
}

function instantLocalHot(tokens: Token[], operatorName: string): string | null {
  if (!tokens.length) return null;
  const sorted = [...tokens].sort((a, b) => b.change24hPct - a.change24hPct);
  const top = sorted.slice(0, 5);
  const lines = top.map(
    (t, i) => `${i + 1}. ${t.symbol} ${formatPct(t.change24hPct)} · ${formatUsd(t.priceUsd)} · liq ${formatUsd(t.liquidityUsd)}`,
  );
  return `Hottest in your live pool right now, ${operatorName}:\n${lines.join("\n")}\n\nSay a symbol for a full Sentinel sweep.`;
}

/**
 * Synchronous instant crypto answers — zero network wait (uses in-memory token pool).
 */
export function tryInstantCryptoAnswer(text: string, ctx: OracleConversationContext): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const legacy = oracleRespondToMessage(trimmed, ctx);
  if (legacy) return legacy;

  if (isTopMoversQuestion(trimmed)) {
    const fromBoard = ctx.moversBoard ? formatTopMoversAnswer(trimmed, ctx.moversBoard, ctx.operatorName) : "";
    if (fromBoard) return fromBoard;
    const local = formatLocalPoolMoversAnswer(trimmed, ctx.tokens, ctx.operatorName);
    if (local) return local;
    return null;
  }

  if (/what('?s| is) (pumping|moving|hot)\b/i.test(trimmed) && !isTopMoversQuestion(trimmed)) {
    return instantLocalHot(ctx.tokens, ctx.operatorName);
  }

  const concept = answerCryptoConcept(trimmed, ctx.titanBotName);
  if (concept) return concept;

  const comparison = COMPARE_QUERY.test(trimmed) ? instantComparison(trimmed, ctx.tokens) : null;
  if (comparison) return comparison;

  const token = resolveOracleTokenQuery(trimmed, ctx.tokens);
  if (token) {
    if (TRADE_QUERY.test(trimmed)) return instantTradeRead(token, ctx.operatorName);
    if (PRICE_QUERY.test(trimmed) || /^(\$?[A-Za-z]{2,12})\??$/.test(trimmed.trim())) {
      return instantPriceRead(token);
    }
    if (classifyTitanIntent(trimmed) === "token_lookup" || token.symbol.length >= 2) {
      return instantTokenBrief(token, ctx.operatorName);
    }
  }

  const bareSymbol = trimmed.match(/^(\$?[A-Za-z]{2,12})$/);
  if (bareSymbol) {
    const hit = resolveOracleTokenQuery(bareSymbol[1] ?? "", ctx.tokens);
    if (hit) return instantTokenBrief(hit, ctx.operatorName);
  }

  return null;
}
