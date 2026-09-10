import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { resolveTitanAuthPlan, supabaseAdminFromEnv } from "../../lib/server/titan/authPlan.js";

type Env = Record<string, string | undefined>;

export async function handleWhaleEvents(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<void> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const auth = await resolveTitanAuthPlan(req, env);
  if (auth.plan !== "PRO") {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "pro_required", events: [] }));
    return;
  }

  const admin = supabaseAdminFromEnv(env);
  if (!admin) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "unavailable", events: [] }));
    return;
  }

  const since = new URL(req.url || "/", "http://local").searchParams.get("since");
  let query = admin
    .from("whale_events")
    .select("id, mint, symbol, side, usd_amount, wallet, tx_signature, source, detected_at")
    .eq("side", "buy")
    .order("detected_at", { ascending: false })
    .limit(30);

  if (since) {
    query = query.gt("detected_at", since);
  }

  const { data, error } = await query;
  if (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message, events: [] }));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ events: data ?? [] }));
}

export function configureWhaleEventsApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/whale/events", async (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    await handleWhaleEvents(req, res, env);
  });
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
};

type ServerlessResponse = {
  setHeader(name: string, value: string): void;
  end(body?: string): void;
  statusCode?: number;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  await handleWhaleEvents(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    process.env,
  );
}
