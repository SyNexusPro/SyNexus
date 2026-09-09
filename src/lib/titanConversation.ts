import { isTopMoversQuestion, parseMoverTimeframeFromText } from "./moverTimeframes";
import { publishHeraLiveMeta, type HeraLiveMeta } from "./hera/liveIntel";
import { rememberHeraFocus, resolveHeraFocus } from "./hera/heraSessionFocus";
import { recordHeraGrowth } from "./hera/growth";
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
  fastMode?: boolean;
  /** Spoken Hera session — conversational, no markdown. */
  spokenReply?: boolean;
};

const WHALE_ASK =
  /\b(whale|whales|large buy|big buy|leviathan alert|whale alert|who(?:'s| is) buying)\b/i;

function turnsToHistory(turns: ConversationTurn[]): TitanChatHistoryMessage[] {
  return turns
    .slice(-16)
    .map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
      content: turn.text.slice(0, 2500),
    }))
    .filter((turn) => turn.content.trim());
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} $%+.-]/gu, "").trim();
}

function tooSimilarToRecent(reply: string, turns: ConversationTurn[]): boolean {
  const next = normalizeForCompare(reply);
  if (next.length < 40) return false;
  const recent = turns
    .filter((t) => t.role === "oracle")
    .slice(-3)
    .map((t) => normalizeForCompare(t.text))
    .filter((t) => t.length > 24);
  for (const prior of recent) {
    if (next === prior) return true;
    if (next.slice(0, 72) === prior.slice(0, 72)) return true;
    const aw = new Set(next.split(" ").filter((w) => w.length > 3));
    const bw = new Set(prior.split(" ").filter((w) => w.length > 3));
    if (aw.size < 6 || bw.size < 6) continue;
    let inter = 0;
    for (const w of aw) if (bw.has(w)) inter += 1;
    const union = aw.size + bw.size - inter;
    if (union > 0 && inter / union > 0.92) return true;
  }
  return false;
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
        const parsed = JSON.parse(line) as { delta?: string; error?: string; live?: HeraLiveMeta };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.live && typeof parsed.live.capturedAt === "number") {
          publishHeraLiveMeta(parsed.live);
          if (parsed.live.symbol && parsed.live.mint) {
            rememberHeraFocus({
              symbol: parsed.live.symbol,
              name: parsed.live.name || parsed.live.symbol,
              mintAddress: parsed.live.mint,
            });
          }
        }
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
 * Titan brain: live ticker snapshots stay instant. Everything else thinks via the LLM.
 */
export async function respondToTitanMessage(
  text: string,
  ctx: OracleConversationContext,
  turns: ConversationTurn[],
  handlers: TitanStreamHandlers = {},
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "What can I help with?";
  recordHeraGrowth("reply");

  const instant = handlers.spokenReply ? null : tryInstantCryptoAnswer(trimmed, ctx);
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

  let mintIntel: string | null = null;
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
          mintIntel = `${pair.baseToken.symbol}: ${priceLabel} · 24h ${chLabel} · liq ${liqLabel} · mint verified on DexScreener.`;
        }
      }
    } catch {
      /* fall through to LLM */
    }
  }

  const intent = classifyTitanIntent(trimmed);
  const token = resolveHeraFocus(trimmed, ctx.tokens, turns.map((t) => ({ role: t.role, text: t.text })));
  if (token && "id" in token && hasTitanMemoryConsent()) rememberFavoriteSymbol(token.symbol);

  const memory = hasTitanMemoryConsent() ? loadTitanMemoryProfile() : null;
  const historyTurns = turnsToHistory(turns);
  const basePayload = buildTitanChatPayload(trimmed, ctx, historyTurns, memory);
  const payload = {
    ...basePayload,
    fastMode: handlers.fastMode === true,
    spokenReply: handlers.spokenReply === true,
    intentHint:
      basePayload.intentHint === "launch_watch"
        ? "launch_watch"
        : isTopMoversQuestion(trimmed)
          ? "market_movers"
          : basePayload.intentHint ?? intent,
    tokenIntel: [basePayload.tokenIntel, mintIntel].filter(Boolean).join("\n") || basePayload.tokenIntel,
  };

  const askLlm = (nextPayload: typeof payload) => streamTitanChatApi(nextPayload, handlers);

  try {
    const llm = await askLlm(payload);
    if (llm && tooSimilarToRecent(llm, turns)) {
      const retry = await askLlm({
        ...payload,
        history: [
          ...payload.history,
          { role: "assistant", content: llm },
          {
            role: "user",
            content:
              "You repeated yourself. Answer my last question again with a new angle — no recycled opener, closer, or ranked-list intro.",
          },
        ],
      });
      if (retry) return retry;
    }
    if (llm) return llm;
  } catch {
    /* fall through */
  }

  // Live ranking fallback if Hera's LLM path fails
  if (isTopMoversQuestion(trimmed)) {
    const timeframe = parseMoverTimeframeFromText(trimmed);
    const cached = ctx.moversBoard?.[timeframe];
    if (cached?.gainers.length) {
      const moversAnswer = formatTopMoversAnswer(trimmed, ctx.moversBoard!, ctx.operatorName);
      if (moversAnswer) return moversAnswer;
    }
    const local = formatLocalPoolMoversAnswer(trimmed, ctx.tokens, ctx.operatorName);
    if (local) return local;
    try {
      const slice = await fetchSolanaTopMovers(timeframe);
      const moversAnswer = formatTopMoversAnswerFromResult(trimmed, slice, ctx.operatorName);
      if (moversAnswer) return moversAnswer;
    } catch {
      /* ignore */
    }
  }

  return reactToFreeText(trimmed, ctx);
}

/** @deprecated Use isInstantCryptoPath — LLM is fallback after instant crypto brain. */
export function shouldUseTitanLlm(_text: string, fastBrainReply: string): boolean {
  return !fastBrainReply;
}

export { isInstantCryptoPath };

export function isGenericTitanFallback(reply: string): boolean {
  return /Got it|thinking out loud|What's the real question|I'll answer it properly this time/.test(reply);
}
