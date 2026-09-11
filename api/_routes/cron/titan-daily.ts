import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { supabaseAdminFromEnv } from "../../../lib/server/titan/authPlan.js";

type Env = Record<string, string | undefined>;

function authorize(req: IncomingMessage, env: Env): boolean {
  const secret = env.CRON_SECRET?.trim() || env.TITAN_EVENT_SECRET?.trim() || "";
  if (!secret) return true;
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const header = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
  return auth.includes(secret) || header === secret;
}

function resolveLlm(env: Env) {
  const apiKey = env.TITAN_API_KEY?.trim() || env.OPENAI_API_KEY?.trim();
  const baseUrl = (
    env.TITAN_API_BASE?.trim() ||
    env.OPENAI_API_BASE?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    env.TITAN_MODEL_PRO?.trim() ||
    env.TITAN_MODEL?.trim() ||
    env.OPENAI_MODEL_PRO?.trim() ||
    env.OPENAI_MODEL?.trim() ||
    (/groq\.com/i.test(baseUrl) ? "llama-3.3-70b-versatile" : "gpt-4o");
  return { apiKey, baseUrl, model };
}

export async function handleTitanDailyBrief(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  if (!authorize(req, env)) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const admin = supabaseAdminFromEnv(env);
  if (!admin) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "supabase_unavailable" }));
    return;
  }

  const { apiKey, baseUrl, model } = resolveLlm(env);
  if (!apiKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "llm_unavailable" }));
    return;
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: events } = await admin
      .from("titan_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80);

    const prompt = `
Create today's Titan Intelligence Brief.

Analyze these events:

${JSON.stringify(events || [], null, 2)}

The report should contain:

MARKET OVERVIEW

BIGGEST MOVES

IMPORTANT BLOCKCHAIN ACTIVITY

WHALE ACTIVITY

SECURITY / SCAM WARNINGS

IMPORTANT NEWS

WHAT MATTERS TODAY

TITAN OUTLOOK

WHAT TITAN IS WATCHING NEXT

Do not just repeat events.
Explain significance and relationships between events.
Keep it under 900 words. Direct, analyst voice.
`;

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 1600,
        messages: [
          {
            role: "system",
            content:
              "You are Titan AI, an elite crypto and market intelligence analyst for SyNexus Pro subscribers.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const result = (await aiResponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const briefing =
      result?.choices?.[0]?.message?.content?.trim() ||
      "No significant Titan events in the last 24 hours. Stay sharp — Leviathan is watching.";

    await admin.from("titan_events").insert({
      type: "DAILY_BRIEF",
      title: "Titan Daily Intelligence Brief",
      summary: briefing.slice(0, 2000),
      severity: "normal",
      metadata: { eventCount: events?.length ?? 0 },
    });

    let users: { id: string }[] = [];
    const { data: byDigest } = await admin
      .from("profiles")
      .select("id")
      .eq("subscription_status", "active")
      .eq("daily_digest", true)
      .eq("notifications_enabled", true);
    users = byDigest ?? [];

    if (!users.length) {
      const { data: byPlan } = await admin.from("profiles").select("id").eq("paid_plan", "PRO");
      users = byPlan ?? [];
    }

    if (users.length) {
      await admin.from("titan_notifications").insert(
        users.map((user) => ({
          user_id: user.id,
          title: "Titan Daily Intelligence Brief",
          message: briefing,
          priority: "daily",
        })),
      );
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, briefing, recipients: users.length }));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Daily Titan briefing failed" }));
  }
}

export function configureTitanDailyApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/cron/titan-daily", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST") {
      next();
      return;
    }
    await handleTitanDailyBrief(req, res, env);
  });
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ServerlessResponse = {
  setHeader(name: string, value: string): void;
  end(body?: string): void;
  statusCode?: number;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  await handleTitanDailyBrief(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    process.env,
  );
}
