import { softenTitanResponse } from "./titanGuardrails";
import {
  buildTitanChatPayload,
  type TitanChatHistoryMessage,
} from "./titanContextPack";
import { loadTitanMemoryProfile, hasTitanMemoryConsent, rememberFavoriteSymbol } from "./titanMemory";
import { oracleRespondToMessage, resolveOracleTokenQuery } from "./oracleCryptoBrain";
import { isInstantTitanPath } from "./titanRouting";
import {
  reactToFreeText,
  type ConversationTurn,
  type OracleConversationContext,
} from "./oracleSupremeConversation";

export type TitanStreamHandlers = {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
};

function turnsToHistory(turns: ConversationTurn[]): TitanChatHistoryMessage[] {
  return turns
    .slice(-10)
    .map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
      content: turn.text,
    }))
    .filter((turn) => turn.content.trim());
}

/** Pre-warm the Titan API route when the chat opens (reduces first-reply latency). */
export function warmTitanBrain(): void {
  void fetch("/api/titan/warm", { method: "GET" }).catch(() => {
    /* optional */
  });
}

async function streamTitanChatApi(
  payload: ReturnType<typeof buildTitanChatPayload>,
  handlers: TitanStreamHandlers,
): Promise<string> {
  const response = await fetch("/api/titan/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!response.ok) {
    if (response.status === 503) throw new Error("llm_unavailable");
    if (response.status === 429) throw new Error("rate_limited");
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
 * Titan brain: instant scans/status → streaming LLM for everything else.
 */
export async function respondToTitanMessage(
  text: string,
  ctx: OracleConversationContext,
  turns: ConversationTurn[],
  handlers: TitanStreamHandlers = {},
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "What's on your mind? I'm ready.";

  if (isInstantTitanPath(trimmed)) {
    const instant = oracleRespondToMessage(trimmed, ctx);
    if (instant) return instant;
  }

  const token = resolveOracleTokenQuery(trimmed, ctx.tokens);
  if (token && hasTitanMemoryConsent()) rememberFavoriteSymbol(token.symbol);

  const memory = hasTitanMemoryConsent() ? loadTitanMemoryProfile() : null;
  const payload = buildTitanChatPayload(trimmed, ctx, turnsToHistory(turns), memory);

  try {
    const llm = await streamTitanChatApi(payload, handlers);
    if (llm) return llm;
  } catch {
    /* fall through */
  }

  return reactToFreeText(trimmed, ctx);
}

/** @deprecated Use isInstantTitanPath — LLM is default for all non-instant messages. */
export function shouldUseTitanLlm(_text: string, fastBrainReply: string): boolean {
  return !fastBrainReply;
}

export function isGenericTitanFallback(reply: string): boolean {
  return /Got it|thinking out loud|What's the real question/.test(reply);
}
