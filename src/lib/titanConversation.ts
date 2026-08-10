import { isTopMoversQuestion, parseMoverTimeframeFromText, type MoverTimeframe } from "./moverTimeframes";
import { fetchSolanaTopMovers } from "../services/marketDataService";
import { formatLocalPoolMoversAnswer, formatTopMoversAnswer, formatTopMoversAnswerFromResult } from "./titanMoversAnswer";
import { softenTitanResponse } from "./titanGuardrails";
import {
  buildTitanChatPayload,
  classifyTitanIntent,
  type TitanChatHistoryMessage,
} from "./titanContextPack";
import { loadTitanMemoryProfile, hasTitanMemoryConsent, rememberFavoriteSymbol } from "./titanMemory";
import { resolveOracleTokenQuery } from "./oracleCryptoBrain";
import { isInstantCryptoPath, tryInstantCryptoAnswer } from "./titanInstantCrypto";
import {
  reactToFreeText,
  type ConversationTurn,
  type OracleConversationContext,
} from "./oracleSupremeConversation";
import { authHeaders } from "./authSession";
import { fetchRecentWhaleEvents, titanWhaleBrief } from "./whaleAlerts";
import { normalizeSynexusPlan, PLAN_STORAGE_KEY } from "./tradingFees";

export type TitanStreamHandlers = {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
};

const CRYPTO_INTENTS = new Set([
  "trade_decision",
  "comparison",
  "token_lookup",
  "strategy",
  "explain",
  "market_movers",
]);

const WHALE_ASK =
  /\b(whale|whales|large buy|big buy|leviathan alert|whale alert|who(?:'s| is) buying)\b/i;

function turnsToHistory(turns: ConversationTurn[], cryptoFast: boolean): TitanChatHistoryMessage[] {
  const limit = cryptoFast ? 4 : 8;
  return turns
    .slice(-limit)
    .map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
      content: turn.text.slice(0, cryptoFast ? 1200 : 2000),
    }))
    .filter((turn) => turn.content.trim());
}

/** Pre-warm Titan + LLM connection when chat opens (cuts first-token latency). */
export function warmTitanBrain(): void {
  void fetch("/api/titan/warm", { method: "POST", keepalive: true }).catch(() => {
    void fetch("/api/titan/warm", { method: "GET", keepalive: true }).catch(() => {
      /* optional */
    });
  });
}

async function streamTitanChatApi(
  payload: ReturnType<typeof buildTitanChatPayload>,
  handlers: TitanStreamHandlers,
): Promise<string> {
  const response = await fetch("/api/titan/chat", {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!response.ok) {
    if (response.status === 503) throw new Error("llm_unavailable");
    if (response.status === 429) throw new Error("rate_limited");
    if (response.status === 400) throw new Error("blocked_content");
    throw new Error(`titan_chat_${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("no_stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event
        .split("\n")
        .find((row) => row.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as { delta?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.delta) {
          full += parsed.delta;
          handlers.onDelta?.(full);
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("llm_")) throw error;
      }
    }
  }

  return softenTitanResponse(full.trim());
}

/**
 * Titan brain: instant crypto reads → streaming LLM for everything else.
 */
export async function respondToTitanMessage(
  text: string,
  ctx: OracleConversationContext,
  turns: ConversationTurn[],
  handlers: TitanStreamHandlers = {},
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "What's on your mind? I'm ready.";

  const instant = tryInstantCryptoAnswer(trimmed, ctx);
  if (instant) return instant;

  let plan: "FREE" | "PRO" = "FREE";
  try {
    plan = normalizeSynexusPlan(localStorage.getItem(PLAN_STORAGE_KEY));
  } catch {
    /* ignore */
  }
  if (WHALE_ASK.test(trimmed) && plan === "PRO") {
    const events = await fetchRecentWhaleEvents();
    const brief = titanWhaleBrief(events, ctx.operatorName);
    if (brief) return brief;
  }

  if (isTopMoversQuestion(trimmed)) {
    const timeframe = parseMoverTimeframeFromText(trimmed);
    const cached = ctx.moversBoard?.[timeframe];
    if (cached?.gainers.length) {
      const moversAnswer = formatTopMoversAnswer(trimmed, ctx.moversBoard!, ctx.operatorName);
      if (moversAnswer) return moversAnswer;
    }
    const local = formatLocalPoolMoversAnswer(trimmed, ctx.tokens, ctx.operatorName);
    if (local) return local;

    const needsHistorical = (["7d", "30d", "365d"] as MoverTimeframe[]).includes(timeframe);
    if (needsHistorical) {
      const slice = await fetchSolanaTopMovers(timeframe);
      const moversAnswer = formatTopMoversAnswerFromResult(trimmed, slice, ctx.operatorName);
      if (moversAnswer) return moversAnswer;
    }
  }

  const mintMatch = trimmed.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  if (mintMatch && !resolveOracleTokenQuery(trimmed, ctx.tokens)) {
    try {
      const mint = mintMatch[1]!;
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
        { signal: handlers.signal },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          pairs?: {
            baseToken?: { symbol?: string };
            priceUsd?: string;
            priceChange?: { h24?: number };
            liquidity?: { usd?: number };
          }[];
        };
        const pair = json.pairs?.[0];
        if (pair?.baseToken?.symbol) {
          const price = Number(pair.priceUsd);
          const ch = Number(pair.priceChange?.h24 ?? 0);
          const liq = Number(pair.liquidity?.usd ?? 0);
          const priceLabel = Number.isFinite(price) ? `$${price}` : "—";
          const chLabel = Number.isFinite(ch) ? `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%` : "—";
          const liqLabel = Number.isFinite(liq) ? `$${Math.round(liq).toLocaleString()}` : "—";
          return `${pair.baseToken.symbol}: ${priceLabel} · 24h ${chLabel} · liq ${liqLabel} · mint verified on DexScreener. Ask for Avoid/Watch/OK when it's in your live pool.`;
        }
      }
    } catch {
      /* fall through to LLM */
    }
  }

  const intent = classifyTitanIntent(trimmed);
  const cryptoFast = CRYPTO_INTENTS.has(intent) || isInstantCryptoPath(trimmed);

  const token = resolveOracleTokenQuery(trimmed, ctx.tokens);
  if (token && hasTitanMemoryConsent()) rememberFavoriteSymbol(token.symbol);

  const memory = hasTitanMemoryConsent() ? loadTitanMemoryProfile() : null;
  const basePayload = buildTitanChatPayload(trimmed, ctx, turnsToHistory(turns, cryptoFast), memory);
  const payload = cryptoFast
    ? {
        ...basePayload,
        fastMode: true,
        marketBrief: basePayload.marketBrief.split("\n").slice(0, 8).join("\n"),
        moversBrief: intent === "market_movers" ? basePayload.moversBrief : null,
        operatorBrief: null,
        watchlistBrief: null,
      }
    : { ...basePayload, fastMode: false };

  try {
    const llm = await streamTitanChatApi(payload, handlers);
    if (llm) return llm;
  } catch {
    /* fall through */
  }

  return reactToFreeText(trimmed, ctx);
}

/** @deprecated Use isInstantCryptoPath — LLM is fallback after instant crypto brain. */
export function shouldUseTitanLlm(_text: string, fastBrainReply: string): boolean {
  return !fastBrainReply;
}

export { isInstantCryptoPath };

export function isGenericTitanFallback(reply: string): boolean {
  return /Got it|thinking out loud|What's the real question/.test(reply);
}
