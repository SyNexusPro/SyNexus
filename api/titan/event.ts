import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { supabaseAdminFromEnv } from "../../lib/server/titan/authPlan.js";
import { classifyEvent, shouldSendInstantPremium, type TitanSeverity } from "../../lib/server/titan/classifyEvent.js";
import { sendPremiumAlert } from "../../lib/server/titan/sendPremiumAlert.js";

type Env = Record<string, string | undefined>;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authorize(req: IncomingMessage, env: Env): boolean {
  const secret = env.TITAN_EVENT_SECRET?.trim() || env.HELIUS_WEBHOOK_SECRET?.trim() || env.CRON_SECRET?.trim() || "";
  if (!secret) return true;
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const header = typeof req.headers["x-titan-secret"] === "string" ? req.headers["x-titan-secret"] : "";
  return auth.includes(secret) || header === secret;
}

export async function handleTitanEvent(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  if (!authorize(req, env)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const admin = supabaseAdminFromEnv(env);
  if (!admin) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "supabase_unavailable" }));
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "invalid_json" }));
    return;
  }

  const type = typeof body.type === "string" ? body.type.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!type || !title) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "type_and_title_required" }));
    return;
  }

  const summary = typeof body.summary === "string" ? body.summary : null;
  const symbol = typeof body.symbol === "string" ? body.symbol : null;
  const tokenAddress =
    typeof body.tokenAddress === "string"
      ? body.tokenAddress
      : typeof body.token_address === "string"
        ? body.token_address
        : null;
  const price = typeof body.price === "number" ? body.price : Number(body.price) || null;
  const metadata =
    body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : {};

  const metaUsd = Number(metadata.usdValue ?? metadata.usd_amount ?? metadata.whaleMovementUsd ?? 0);
  let severity: TitanSeverity =
    body.severity === "low" ||
    body.severity === "normal" ||
    body.severity === "high" ||
    body.severity === "critical"
      ? body.severity
      : classifyEvent({
          type,
          whaleMovementUsd: metaUsd,
          transactionValueUsd: metaUsd,
          priceChangePercent: Number(metadata.priceChangePercent ?? 0) || undefined,
          securityThreat: Boolean(metadata.securityThreat),
          exploitDetected: Boolean(metadata.exploitDetected),
          exchangeHack: Boolean(metadata.exchangeHack),
        });

  const { data: event, error } = await admin
    .from("titan_events")
    .insert({
      type,
      title,
      summary,
      symbol,
      token_address: tokenAddress,
      price,
      severity,
      metadata,
    })
    .select()
    .single();

  if (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message }));
    return;
  }

  let fanout = { notified: 0, pushed: 0 };
  if (shouldSendInstantPremium(severity)) {
    fanout = await sendPremiumAlert(
      admin,
      {
        eventId: event.id,
        title,
        message: summary || title,
        priority: severity,
      },
      env,
    );
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ success: true, event, fanout }));
}

export function configureTitanEventApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/titan/event", async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    await handleTitanEvent(req, res, env);
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
  await handleTitanEvent(req as unknown as IncomingMessage, res as unknown as ServerResponse, process.env);
}
