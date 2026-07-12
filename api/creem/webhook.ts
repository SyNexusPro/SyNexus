import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { ViteDevServer } from "vite";
import { readCreemConfig, type CreemEnv } from "../../server/creem/config";

type PaidPlan = "PRO";

type CreemWebhookEvent = {
  id?: string;
  eventType?: string;
  object?: {
    metadata?: Record<string, unknown>;
    customer?: { email?: string };
    order?: { amount?: number; currency?: string };
  };
};

type WebhookEnv = CreemEnv & {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const GRANT_EVENTS = new Set([
  "checkout.completed",
  "subscription.active",
  "subscription.paid",
  "subscription.trialing",
]);

const REVOKE_EVENTS = new Set([
  "subscription.canceled",
  "subscription.expired",
  "subscription.paused",
]);

function readRawBody(req: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function verifyCreemSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function getPlanFromMetadata(metadata: Record<string, unknown> | undefined): PaidPlan | null {
  return metadata?.plan === "PRO" ? "PRO" : null;
}

function getUserIdFromMetadata(metadata: Record<string, unknown> | undefined): string | null {
  const userId = metadata?.userId;
  if (typeof userId !== "string") return null;
  const trimmed = userId.trim();
  return trimmed && trimmed !== "anonymous" ? trimmed : null;
}

export async function handleCreemWebhookRequest(
  rawBody: Buffer,
  signature: string | undefined,
  env: WebhookEnv,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const { webhookSecret } = readCreemConfig(env);
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      body: {
        error:
          "Webhook env is missing. Set CREEM_WEBHOOK_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
      },
    };
  }

  if (!verifyCreemSignature(rawBody, signature, webhookSecret)) {
    return { statusCode: 401, body: { error: "Invalid webhook signature" } };
  }

  let event: CreemWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as CreemWebhookEvent;
  } catch {
    return { statusCode: 400, body: { error: "Invalid JSON payload" } };
  }

  const eventType = event.eventType ?? "";
  const metadata = event.object?.metadata;
  const plan = getPlanFromMetadata(metadata);
  const userId = getUserIdFromMetadata(metadata);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (userId && plan && GRANT_EVENTS.has(eventType)) {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      paid_plan: plan,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  if (userId && REVOKE_EVENTS.has(eventType)) {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      paid_plan: "FREE",
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  return {
    statusCode: 200,
    body: {
      received: true,
      type: eventType,
      eventId: event.id,
    },
  };
}

export function configureCreemWebhookApi(server: ViteDevServer, env: WebhookEnv) {
  for (const path of ["/api/webhook", "/api/creem/webhook"]) {
    server.middlewares.use(path, async (req, res, next) => {
      if (req.method !== "POST") {
        next();
        return;
      }

      try {
        const signature = getHeaderValue(req.headers["creem-signature"]);
        const rawBody = await readRawBody(req);
        const result = await handleCreemWebhookRequest(rawBody, signature, env);
        res.statusCode = result.statusCode;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Failed to process webhook",
          }),
        );
      }
    });
  }
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ServerlessResponse = {
  status(statusCode: number): ServerlessResponse;
  json(body: unknown): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const rawBody =
      typeof req.body === "string"
        ? Buffer.from(req.body, "utf8")
        : Buffer.isBuffer(req.body)
          ? req.body
          : await readRawBody(req);

    const signature = getHeaderValue(req.headers["creem-signature"]);
    const result = await handleCreemWebhookRequest(rawBody, signature, process.env);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process webhook",
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
