import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { supabaseAdminFromEnv } from "../../lib/server/titan/authPlan.js";
import {
  persistDiscoveryEvaluations,
  scanEmergingSolanaAssets,
} from "../../lib/server/titan/discoveryScan.js";

type Env = Record<string, string | undefined>;

function authorize(req: IncomingMessage, env: Env): boolean {
  const secret = env.CRON_SECRET?.trim() || env.TITAN_EVENT_SECRET?.trim() || "";
  if (!secret) return true;
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const header = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
  return auth.includes(secret) || header === secret;
}

export async function handleTitanDiscoveryCron(
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
    const evaluations = await scanEmergingSolanaAssets(16);
    const result = await persistDiscoveryEvaluations(admin, evaluations, env);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        scannedReportable: evaluations.length,
        ...result,
        top: evaluations.slice(0, 5).map((e) => ({
          symbol: e.symbol,
          discovery: e.discoveryScore,
          risk: e.riskScore,
          momentum: e.momentumScore,
          confidence: e.confidence,
          highRisk: e.highRiskReportable,
        })),
      }),
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : "discovery_failed" }));
  }
}

export function configureTitanDiscoveryApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/cron/titan-discovery", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST") {
      next();
      return;
    }
    await handleTitanDiscoveryCron(req, res, env);
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
  await handleTitanDiscoveryCron(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    process.env,
  );
}
