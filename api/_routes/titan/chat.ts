import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { buildTitanSystemPrompt, resolveDefaultCommanderPersona, type TitanPromptInput } from "../../../lib/server/titan/prompt.js";
import { resolveTitanAuthPlan } from "../../../lib/server/titan/authPlan.js";
import { guardTitanServerMessage } from "../../../lib/server/titan/sanitize.js";
import { titanCacheGet, titanCacheSet } from "../../../lib/server/titan/responseCache.js";
import { fetchLiveSolanaWatchlist, needsLiveMarketFetch } from "../../../lib/server/titan/liveMarketBrief.js";
import {
  fetchVerifiedTokenSnapshot,
  needsLiveTokenFetch,
  resolveLiveTokenQuery,
} from "../../../lib/server/titan/liveTokenIntel.js";
import {
  formatLaunchWatchBrief,
  needsLaunchWatchFetch,
  scanLaunchWatch,
} from "../../../lib/server/titan/launchWatchScan.js";

export type TitanChatRequestBody = TitanPromptInput & {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
};

type TitanEnv = Record<string, string | undefined>;

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  return req.socket.remoteAddress ?? "unknown";
}

function checkRateLimit(
  key: string,
  plan: "FREE" | "PRO",
): { ok: true } | { ok: false; retryAfterSec: number } {
  const limit = plan === "PRO" ? 180 : 40;
  const windowMs = 60 * 60 * 1000;
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true };
}

type LlmEndpoint = {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
};

function openaiBase(env: TitanEnv): string {
  return (env.OPENAI_API_BASE?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
}

/** Hera spoken path — real OpenAI, never the Groq/Titan proxy key. */
function resolveHeraOpenAi(env: TitanEnv, plan: "FREE" | "PRO"): LlmEndpoint | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    env.HERA_OPENAI_MODEL?.trim() ||
    env.OPENAI_MODEL_HERA?.trim() ||
    env.OPENAI_MODEL_PRO?.trim() ||
    env.OPENAI_MODEL?.trim() ||
    "gpt-4o";
  return {
    apiKey,
    baseUrl: openaiBase(env),
    model,
    maxTokens: plan === "PRO" ? 2200 : 1800,
  };
}

function resolveLlmConfig(env: TitanEnv, plan: "FREE" | "PRO" = "FREE", fastMode = false): LlmEndpoint {
  const groqKey = env.TITAN_API_KEY?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const baseUrl = (
    env.TITAN_API_BASE?.trim() ||
    env.OPENAI_API_BASE?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const groq = /groq\.com/i.test(baseUrl);
  const strongGroq = "llama-3.3-70b-versatile";
  const model =
    plan === "PRO"
      ? env.TITAN_MODEL_PRO?.trim() ||
        env.OPENAI_MODEL_PRO?.trim() ||
        env.TITAN_MODEL?.trim() ||
        env.OPENAI_MODEL?.trim() ||
        (groq ? strongGroq : "gpt-4o")
      : env.TITAN_MODEL_FREE?.trim() ||
        env.OPENAI_MODEL_FREE?.trim() ||
        env.TITAN_MODEL?.trim() ||
        env.OPENAI_MODEL?.trim() ||
        (groq ? strongGroq : "gpt-4o-mini");
  const defaultMax = fastMode
    ? plan === "PRO"
      ? 900
      : 720
    : plan === "PRO"
      ? 2200
      : 1600;
  const maxTokens = Math.min(
    fastMode ? 1200 : 2800,
    Math.max(
      fastMode ? 280 : 400,
      Number(
        plan === "PRO"
          ? env.TITAN_MAX_TOKENS_PRO ?? env.TITAN_MAX_TOKENS ?? defaultMax
          : env.TITAN_MAX_TOKENS ?? defaultMax,
      ) || defaultMax,
    ),
  );
  const apiKey = groqKey || openaiKey || "";
  return { apiKey, baseUrl, model, maxTokens };
}

function resolveChatEndpoint(
  env: TitanEnv,
  body: TitanChatRequestBody,
): { primary: LlmEndpoint; fallback: LlmEndpoint | null } {
  const openai = resolveHeraOpenAi(env, body.plan);
  const groq = resolveLlmConfig(env, body.plan, body.fastMode === true);
  if (openai) {
    const fallback = groq.apiKey && groq.baseUrl !== openai.baseUrl ? groq : null;
    return { primary: openai, fallback };
  }
  return { primary: groq, fallback: null };
}

/** Natural assistant temperature — close to ChatGPT / Gemini, not a random briefing bot. */
function resolveTemperature(plan: "FREE" | "PRO", fastMode = false): number {
  if (fastMode) return 0.7;
  return plan === "PRO" ? 0.8 : 0.75;
}

function recentAssistantSnippets(
  history: { role: "user" | "assistant"; content: string }[],
): string[] {
  return history
    .filter((t) => t.role === "assistant")
    .slice(-4)
    .map((t) => {
      const compact = t.content.replace(/\s+/g, " ").trim();
      const firstLine = compact.split(/(?<=[.!?])\s/)[0] ?? compact;
      return firstLine.slice(0, 180);
    })
    .filter(Boolean);
}

function sanitizeMessage(text: string): string {
  return text.trim().slice(0, 4000);
}

function validateBody(raw: unknown): TitanChatRequestBody | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const message = typeof body.message === "string" ? sanitizeMessage(body.message) : "";
  if (!message) return null;

  const titanBotName =
    typeof body.titanBotName === "string" && body.titanBotName.trim()
      ? body.titanBotName.trim().slice(0, 40)
      : resolveDefaultCommanderPersona();
  const operatorName =
    typeof body.operatorName === "string" ? body.operatorName.trim().slice(0, 60) : "there";
  // Client-claimed plan is ignored — resolved from auth on the server.
  const plan = "FREE" as const;
  const alertCount = typeof body.alertCount === "number" ? Math.max(0, body.alertCount) : 0;
  const watchlistCount = typeof body.watchlistCount === "number" ? Math.max(0, body.watchlistCount) : 0;
  const feedSource = body.feedSource === "mock" ? "mock" : "live";
  const marketBrief =
    typeof body.marketBrief === "string" ? body.marketBrief.slice(0, 8000) : "No market data.";
  const moversBrief =
    typeof body.moversBrief === "string" && body.moversBrief.trim()
      ? body.moversBrief.trim().slice(0, 4000)
      : null;
  const tokenIntel =
    typeof body.tokenIntel === "string" && body.tokenIntel.trim()
      ? body.tokenIntel.trim().slice(0, 2000)
      : null;

  const operatorBrief =
    typeof body.operatorBrief === "string" && body.operatorBrief.trim()
      ? body.operatorBrief.trim().slice(0, 800)
      : null;

  const sentinelBrief =
    typeof body.sentinelBrief === "string" && body.sentinelBrief.trim()
      ? body.sentinelBrief.trim().slice(0, 2000)
      : null;

  const watchlistBrief =
    typeof body.watchlistBrief === "string" && body.watchlistBrief.trim()
      ? body.watchlistBrief.trim().slice(0, 1200)
      : null;

  const intentValues = new Set([
    "trade_decision",
    "comparison",
    "token_lookup",
    "strategy",
    "life_counsel",
    "explain",
    "market_movers",
    "launch_watch",
    "general",
  ]);
  const intentHint =
    typeof body.intentHint === "string" && intentValues.has(body.intentHint)
      ? (body.intentHint as TitanPromptInput["intentHint"])
      : null;

  let memory: TitanPromptInput["memory"] = null;
  if (body.memory && typeof body.memory === "object") {
    const m = body.memory as Record<string, unknown>;
    memory = {
      favoriteSymbols: Array.isArray(m.favoriteSymbols)
        ? m.favoriteSymbols.filter((s) => typeof s === "string").slice(0, 12)
        : [],
      riskTolerance: typeof m.riskTolerance === "string" ? m.riskTolerance.slice(0, 24) : "balanced",
      tradingNotes: typeof m.tradingNotes === "string" ? m.tradingNotes.slice(0, 500) : "",
    };
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is { role: "user" | "assistant"; content: string } =>
            !!item &&
            typeof item === "object" &&
            (item as { role?: string }).role !== undefined &&
            ((item as { role?: string }).role === "user" ||
              (item as { role?: string }).role === "assistant") &&
            typeof (item as { content?: string }).content === "string",
        )
        .slice(-20)
        .map((item) => ({
          role: item.role,
          content: item.content.trim().slice(0, 2500),
        }))
        .filter((item) => item.content)
    : [];

  const fastMode = body.fastMode === true;
  const spokenReply = body.spokenReply === true;

  const replyLanguage =
    typeof body.replyLanguage === "string" && body.replyLanguage.trim()
      ? body.replyLanguage.trim().slice(0, 24)
      : "en";

  const hostTimeZone =
    typeof body.hostTimeZone === "string" && /^[A-Za-z0-9_/+-]{3,64}$/.test(body.hostTimeZone.trim())
      ? body.hostTimeZone.trim()
      : null;

  const focusMint =
    typeof body.focusMint === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.focusMint.trim())
      ? body.focusMint.trim()
      : null;
  const focusSymbol =
    typeof body.focusSymbol === "string" && /^[A-Za-z0-9]{2,16}$/.test(body.focusSymbol.trim())
      ? body.focusSymbol.trim().toUpperCase()
      : null;

  const research = Array.isArray(body.research) ? body.research.slice(0, 20) : null;

  return {
    message,
    operatorName,
    titanBotName,
    plan,
    alertCount,
    watchlistCount,
    feedSource,
    marketBrief,
    moversBrief,
    operatorBrief,
    sentinelBrief,
    watchlistBrief,
    intentHint,
    tokenIntel,
    memory,
    history,
    fastMode,
    spokenReply,
    replyLanguage,
    hostTimeZone,
    focusMint,
    focusSymbol,
    research,
    recentAssistantSnippets: recentAssistantSnippets(history),
    liveLaunchData: null,
  };
}

/** Ping the LLM once so the first real chat token arrives faster (Groq/OpenAI cold start). */
export async function warmTitanLlm(env: TitanEnv): Promise<boolean> {
  const { apiKey, baseUrl, model } = resolveLlmConfig(env, "FREE", true);
  if (!apiKey) return false;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 1,
        temperature: 0,
        messages: [
          { role: "system", content: "ok" },
          { role: "user", content: "ping" },
        ],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function handleTitanWarm(
  req: IncomingMessage,
  res: ServerResponse,
  env: TitanEnv,
): Promise<void> {
  const ready = !!(env.TITAN_API_KEY?.trim() || env.OPENAI_API_KEY?.trim());
  if (!ready) {
    res.statusCode = 503;
    res.end();
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "POST") {
    const ok = await warmTitanLlm(env);
    res.statusCode = ok ? 204 : 502;
    res.end();
    return;
  }

  res.statusCode = 405;
  res.end();
}

async function* streamChatCompletions(
  endpoint: LlmEndpoint,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  plan: "FREE" | "PRO",
  fastMode: boolean,
): AsyncGenerator<string, void, unknown> {
  if (!endpoint.apiKey) throw new Error("llm_unavailable");

  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${endpoint.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      stream: true,
      max_tokens: endpoint.maxTokens,
      temperature: resolveTemperature(plan, fastMode),
      presence_penalty: 0.1,
      frequency_penalty: 0.15,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`llm_error:${response.status}:${detail.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("llm_stream_unavailable");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* ignore malformed chunks */
      }
    }
  }
}

async function* streamOpenAiChat(
  body: TitanChatRequestBody,
  env: TitanEnv,
): AsyncGenerator<string, void, unknown> {
  const fastMode = body.fastMode === true;
  const { primary, fallback } = resolveChatEndpoint(env, body);
  if (!primary.apiKey) throw new Error("llm_unavailable");

  const system = buildTitanSystemPrompt(body);
  const messages = [
    { role: "system" as const, content: system },
    ...(body.history ?? []).map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: body.message },
  ];

  try {
    yield* streamChatCompletions(primary, messages, body.plan, fastMode);
  } catch (err) {
    if (!fallback?.apiKey) throw err;
    yield* streamChatCompletions(fallback, messages, body.plan, fastMode);
  }
}

export async function handleTitanChatStream(
  req: IncomingMessage,
  res: ServerResponse,
  env: TitanEnv,
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let parsed: TitanChatRequestBody | null;
  try {
    parsed = validateBody(JSON.parse(await readRequestBody(req)));
  } catch {
    parsed = null;
  }

  if (!parsed) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid request" }));
    return;
  }

  const inputGuard = guardTitanServerMessage(parsed.message);
  if (!inputGuard.ok) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "blocked_content", reason: inputGuard.reason }));
    return;
  }

  const auth = await resolveTitanAuthPlan(req, env);
  parsed.plan = auth.plan;

  // Time-sensitive crypto asks → fetch fresh market data server-side before answering.
  if (needsLiveMarketFetch(parsed.message, parsed.intentHint)) {
    try {
      const live = await fetchLiveSolanaWatchlist(parsed.plan === "PRO" ? 10 : 6, parsed.hostTimeZone);
      parsed.liveMarketData = live.brief;
      parsed.intentHint = parsed.intentHint || "market_movers";
      // Don't serve stale cached answers for live ranking questions.
      parsed.fastMode = false;
    } catch {
      parsed.liveMarketData =
        `LIVE MARKET DATA unavailable at ${new Date().toISOString()} (second-accurate UTC). Tell the user live data could not be retrieved — do not invent rankings.`;
    }
  }

  let liveTokenMeta: Awaited<ReturnType<typeof fetchVerifiedTokenSnapshot>>["meta"] | null = null;
  if (needsLiveTokenFetch(parsed.message, { intentHint: parsed.intentHint, focusMint: parsed.focusMint })) {
    try {
      const query = await resolveLiveTokenQuery(parsed.message, parsed.focusMint, parsed.focusSymbol);
      if (query.mint || query.symbol) {
        const snap = await fetchVerifiedTokenSnapshot({
          mint: query.mint,
          symbol: query.symbol,
          timeZone: parsed.hostTimeZone,
        });
        parsed.liveTokenData = snap.brief;
        liveTokenMeta = snap.meta;
        parsed.tokenIntel = null;
        parsed.intentHint = parsed.intentHint || "token_lookup";
        parsed.fastMode = false;
      }
    } catch {
      parsed.liveTokenData =
        "LIVE TOKEN INTELLIGENCE unavailable. Say live DexScreener data could not be retrieved — do not invent price, liquidity, volume, market cap, or holders.";
    }
  }

  if (needsLaunchWatchFetch(parsed.message, parsed.intentHint)) {
    try {
      const leads = await scanLaunchWatch(env);
      parsed.liveLaunchData = formatLaunchWatchBrief(leads, parsed.hostTimeZone);
      parsed.intentHint = parsed.intentHint || "launch_watch";
      parsed.fastMode = false;
    } catch {
      parsed.liveLaunchData =
        "LIVE LAUNCH WATCH unavailable. Say public launch feeds could not be retrieved — do not invent coins, mints, or social posts.";
    }
  }

  const rateKey = auth.userId ? `u:${auth.userId}` : `ip:${clientIp(req)}`;
  const limit = checkRateLimit(rateKey, parsed.plan);
  if (!limit.ok) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Retry-After", String(limit.retryAfterSec));
    res.end(JSON.stringify({ error: "rate_limited", retryAfterSec: limit.retryAfterSec }));
    return;
  }

  const { apiKey } = resolveLlmConfig(env, parsed.plan);
  if (!apiKey) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "llm_unavailable" }));
    return;
  }

  const cacheParts = [
    parsed.plan,
    String(parsed.fastMode),
    parsed.message.toLowerCase(),
    (parsed.tokenIntel || "").slice(0, 120),
    (parsed.history?.at(-1)?.content || "").slice(0, 80),
  ];
  const canCache = parsed.fastMode === true && (parsed.history?.length ?? 0) === 0;
  if (canCache) {
    const cached = titanCacheGet(cacheParts);
    if (cached) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Titan-Cache", "hit");
      res.write(`data: ${JSON.stringify({ delta: cached })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Titan-Plan", parsed.plan);

  try {
    if (liveTokenMeta) {
      res.write(`data: ${JSON.stringify({ live: liveTokenMeta })}\n\n`);
    }
    let full = "";
    for await (const delta of streamOpenAiChat(parsed, env)) {
      full += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    if (canCache && full.trim()) {
      titanCacheSet(cacheParts, full.trim(), parsed.plan === "PRO" ? 5_000 : 10_000);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "llm_failed";
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: message }));
      return;
    }
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
}

export function configureTitanChatApi(server: ViteDevServer, env: TitanEnv) {
  server.middlewares.use("/api/titan/warm", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
      next();
      return;
    }
    await handleTitanWarm(req, res, env);
  });

  server.middlewares.use("/api/titan/chat", async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    await handleTitanChatStream(req, res, env);
  });
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ServerlessResponse = {
  status(statusCode: number): ServerlessResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(body?: string): void;
  headersSent?: boolean;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  await handleTitanChatStream(req as unknown as IncomingMessage, res as unknown as ServerResponse, process.env);
}
