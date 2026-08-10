import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { supabaseAdminFromEnv } from "../../lib/server/titan/authPlan.js";
import { whaleTrackMints } from "../../lib/server/whale/config.js";
import { detectDexVolumeWhales } from "../../lib/server/whale/detect.js";
import { processAndNotifyWhales } from "../../lib/server/whale/notify.js";

type Env = Record<string, string | undefined>;

function authorizePoll(req: IncomingMessage, env: Env): boolean {
  const secret = env.WHALE_POLL_SECRET?.trim() || env.CRON_SECRET?.trim() || "";
  if (!secret) return true; // allow when unset (dev); set in prod
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const header = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
  return auth.includes(secret) || header === secret;
}

export async function handleWhalePoll(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  if (!authorizePoll(req, env)) {
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

  const mints = whaleTrackMints(env);
  if (!mints.length) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, skipped: "no_WHALE_TRACK_MINTS" }));
    return;
  }

  const events = await detectDexVolumeWhales(mints, env);
  const result = await processAndNotifyWhales(env, admin, events);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, ...result, scanned: mints.length }));
}

export function configureWhalePollApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/whale/poll", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST") {
      next();
      return;
    }
    await handleWhalePoll(req, res, env);
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
  await handleWhalePoll(req as unknown as IncomingMessage, res as unknown as ServerResponse, process.env);
}
