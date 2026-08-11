import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { buildTitanSystemPrompt, resolveDefaultCommanderPersona, type TitanPromptInput } from "../../lib/server/titan/prompt.js";
import { resolveTitanAuthPlan } from "../../lib/server/titan/authPlan.js";
import { guardTitanServerMessage } from "../../lib/server/titan/sanitize.js";
import { titanCacheGet, titanCacheSet } from "../../lib/server/titan/responseCache.js";

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

function resolveLlmConfig(env: TitanEnv, plan: "FREE" | "PRO" = "FREE", fastMode = false) {
  const apiKey = env.TITAN_API_KEY?.trim() || env.OPENAI_API_KEY?.trim();
  const baseUrl = (
    env.TITAN_API_BASE?.trim() ||
    env.OPENAI_API_BASE?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const groq = /groq\.com/i.test(baseUrl);
  const model =
    plan === "PRO"
      ? env.TITAN_MODEL_PRO?.trim() ||
        env.OPENAI_MODEL_PRO?.trim() ||
        env.TITAN_MODEL?.trim() ||
        env.OPENAI_MODEL?.trim() ||
        (groq ? "llama-3.3-70b-versatile" : "gpt-4o")
      : env.TITAN_MODEL_FREE?.trim() ||
        env.OPENAI_MODEL_FREE?.trim() ||
        env.TITAN_MODEL?.trim() ||
        env.OPENAI_MODEL?.trim() ||
        (groq ? "llama-3.1-8b-instant" : "gpt-4o-mini");
  const defaultMax = fastMode
    ? plan === "PRO"
      ? 640
      : 480
    : plan === "PRO"
      ? 1400
      : 1000;
  const maxTokens = Math.min(
    fastMode ? 900 : 2000,
    Math.max(
      fastMode ? 180 : 200,
      Number(
        plan === "PRO"
          ? env.TITAN_MAX_TOKENS_PRO ?? env.TITAN_MAX_TOKENS ?? defaultMax
          : env.TITAN_MAX_TOKENS ?? defaultMax,
      ) || defaultMax,
    ),
  );
  return { apiKey, baseUrl, model, maxTokens };
}

function resolveTemperature(plan: "FREE" | "PRO", fastMode = false): number {
  if (fastMode) return plan === "PRO" ? 0.55 : 0.6;
  return plan === "PRO" ? 0.62 : 0.68;
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
        .slice(-10)
        .map((item) => ({
          role: item.role,
          content: item.content.trim().slice(0, 2000),
        }))
    : [];

  const fastMode = body.fastMode === true;

  const replyLanguage =
    typeof body.replyLanguage === "string" && body.replyLanguage.trim()
      ? body.replyLanguage.trim().slice(0, 24)
      : "en";

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
    replyLanguage,
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

async function* streamOpenAiChat(
  body: TitanChatRequestBody,
  env: TitanEnv,
): AsyncGenerator<string, void, unknown> {
  const fastMode = body.fastMode === true;
  const { apiKey, baseUrl, model, maxTokens } = resolveLlmConfig(env, body.plan, fastMode);
  if (!apiKey) throw new Error("llm_unavailable");

  const system = buildTitanSystemPrompt(body);
  const messages = [
    { role: "system" as const, content: system },
    ...body.history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: body.message },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature: resolveTemperature(body.plan, fastMode),
      presence_penalty: fastMode ? 0 : 0.08,
      frequency_penalty: fastMode ? 0 : 0.05,
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
  ];
  if (parsed.fastMode) {
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
    let full = "";
    for await (const delta of streamOpenAiChat(parsed, env)) {
      full += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    if (parsed.fastMode && full.trim()) {
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
