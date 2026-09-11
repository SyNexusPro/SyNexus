import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { supabaseAdminFromEnv } from "../../../lib/server/titan/authPlan.js";
import { persistLaunchLeads, scanLaunchWatch } from "../../../lib/server/titan/launchWatchScan.js";

type Env = Record<string, string | undefined>;

function authorize(req: IncomingMessage, env: Env): boolean {
  const secret = env.CRON_SECRET?.trim() || env.TITAN_EVENT_SECRET?.trim() || "";
  if (!secret) return true;
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const header = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
  return auth.includes(secret) || header === secret;
}

export async function handleTitanLaunchWatchCron(
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

  try {
    const leads = await scanLaunchWatch(env);
    const result = await persistLaunchLeads(admin, leads, env);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        scanned: leads.length,
        ...result,
        top: leads.slice(0, 8).map((lead) => ({
          source: lead.source,
          symbol: lead.symbol,
          mint: lead.mint,
          kind: lead.kind,
          title: lead.title,
        })),
      }),
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "launch_watch_failed" }));
  }
}

export function configureTitanLaunchWatchApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/cron/titan-launch-watch", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST") {
      next();
      return;
    }
    await handleTitanLaunchWatchCron(req, res, env);
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
  await handleTitanLaunchWatchCron(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    process.env,
  );
}
