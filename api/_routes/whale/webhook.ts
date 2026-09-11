import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { supabaseAdminFromEnv } from "../../../lib/server/titan/authPlan.js";
import { whaleWebhookSecret } from "../../../lib/server/whale/config.js";
import { parseHeliusWhaleEvents } from "../../../lib/server/whale/detect.js";
import { processAndNotifyWhales } from "../../../lib/server/whale/notify.js";

type Env = Record<string, string | undefined>;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function handleWhaleWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const secret = whaleWebhookSecret(env);
  const headerSecret =
    (typeof req.headers["authorization"] === "string" && req.headers["authorization"]) ||
    (typeof req.headers["x-whale-secret"] === "string" && req.headers["x-whale-secret"]) ||
    "";
  if (secret && !headerSecret.includes(secret)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const admin = supabaseAdminFromEnv(env);
  if (!admin) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "supabase_unavailable" }));
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "invalid_json" }));
    return;
  }

  const events = parseHeliusWhaleEvents(payload, env);
  const result = await processAndNotifyWhales(env, admin, events);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, ...result, parsed: events.length }));
}

export function configureWhaleWebhookApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/whale/webhook", async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    await handleWhaleWebhook(req, res, env);
  });
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ServerlessResponse = {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  await handleWhaleWebhook(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    process.env,
  );
}
