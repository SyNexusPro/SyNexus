import { useApiRoute, type ViteDevServer } from "../viteDevServer.js";
import {
  evaluateSquareWebhook,
  processAcceptedSquareEvent,
} from "../../../lib/server/square/webhook.js";

/** Browser GET test message — also used as plain-text health check. */
export const SQUARE_WEBHOOK_ACTIVE_MESSAGE = "Square webhook endpoint is active";

/** Production notification URL — must match Square Dashboard exactly. */
export const SQUARE_WEBHOOK_PUBLIC_URL = "https://synexus.pro/api/webhook";
const SQUARE_LIVE_ALIAS_URL = "https://synexus.pro/api/webhooks/square";
const SQUARE_SANDBOX_URL = "https://synexus.pro/api/webhooks/square-sandbox";

export type WebhookEnv = Record<string, string | undefined>;

type RawBodyRequest = NodeJS.ReadableStream & {
  body?: unknown;
  readableEnded?: boolean;
  complete?: boolean;
};

/** Square signs the exact bytes. Never re-serialize a parsed JSON object. */
function readRawBody(req: RawBodyRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (req.body instanceof Uint8Array) return Promise.resolve(Buffer.from(req.body));
  if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body, "utf8"));
  if (req.body && typeof req.body === "object") {
    console.error("[webhook] Parsed JSON body cannot be used for Square signature validation");
  }
  // `complete` only means the HTTP parser finished. The raw bytes are still in the stream.

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      reject(new Error("Timed out reading webhook body"));
    }, 8000);
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    req.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sendActiveMessage(res: { statusCode?: number; setHeader(name: string, value: string): void; end(body?: string): void }) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(SQUARE_WEBHOOK_ACTIVE_MESSAGE);
}

function acknowledgePost(
  res: { statusCode?: number; headersSent?: boolean; setHeader(name: string, value: string): void; end(body?: string): void },
  statusCode: number,
  body: Record<string, unknown>,
) {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function handleWebhookPost(
  req: RawBodyRequest & { headers: Record<string, string | string[] | undefined> },
  env: WebhookEnv,
  respond: (statusCode: number, body: Record<string, unknown>) => void,
) {
  const rawBody = await readRawBody(req);
  const signature = getHeaderValue(req.headers["x-square-hmacsha256-signature"]);
  const decision = evaluateSquareWebhook(rawBody, signature, env);
  if (!decision.ok) {
    respond(decision.statusCode, { error: decision.error });
    return;
  }

  respond(200, { received: true });
  await processAcceptedSquareEvent(decision.event, env);
}

function registerWebhookRoute(server: ViteDevServer, path: string, env: WebhookEnv) {
  useApiRoute(server, path, async (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") {
      sendActiveMessage(res);
      return;
    }

    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      await handleWebhookPost(req, env, (statusCode, body) => {
        acknowledgePost(res, statusCode, body);
      });
    } catch (error) {
      console.error("[webhook]", error);
      if (!res.headersSent) acknowledgePost(res, 500, { error: "Webhook failed" });
    }
  });
}

/** Registers the live, legacy, and sandbox Square webhook routes for Vite dev. */
export function configureSubscriptionWebhookApi(server: ViteDevServer, env: WebhookEnv) {
  for (const path of ["/api/webhook", "/api/square/webhook"]) {
    registerWebhookRoute(server, path, env);
  }
  registerWebhookRoute(server, "/api/webhooks/square", {
    ...env,
    SQUARE_WEBHOOK_SIGNATURE_KEY:
      env.SQUARE_LIVE_WEBHOOK_SIGNATURE_KEY || env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    SQUARE_WEBHOOK_NOTIFICATION_URL:
      env.SQUARE_LIVE_WEBHOOK_NOTIFICATION_URL || SQUARE_LIVE_ALIAS_URL,
  });
  registerWebhookRoute(server, "/api/webhooks/square-sandbox", {
    ...env,
    SQUARE_WEBHOOK_SIGNATURE_KEY: env.SQUARE_SANDBOX_WEBHOOK_SIGNATURE_KEY,
    SQUARE_WEBHOOK_NOTIFICATION_URL:
      env.SQUARE_SANDBOX_WEBHOOK_NOTIFICATION_URL || SQUARE_SANDBOX_URL,
  });
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ServerlessResponse = {
  status(statusCode: number): ServerlessResponse;
  setHeader(name: string, value: string): ServerlessResponse;
  end(body?: string): void;
  json(body: unknown): void;
};

export async function handleSubscriptionWebhook(
  req: ServerlessRequest,
  res: ServerlessResponse,
  env: WebhookEnv = process.env,
) {
  if (req.method === "GET" || req.method === "HEAD") {
    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(SQUARE_WEBHOOK_ACTIVE_MESSAGE);
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let sent = false;
  try {
    await handleWebhookPost(req, env, (statusCode, body) => {
      if (sent) return;
      sent = true;
      if (typeof res.status === "function") {
        const reply = res.status(statusCode);
        if (reply && typeof reply.json === "function") {
          reply.json(body);
          return;
        }
      }
      const nodeRes = res as ServerlessResponse & {
        statusCode?: number;
        headersSent?: boolean;
      };
      if (nodeRes.headersSent) return;
      nodeRes.statusCode = statusCode;
      nodeRes.setHeader("Content-Type", "application/json");
      nodeRes.end(JSON.stringify(body));
    });
  } catch (error) {
    console.error("[webhook]", error);
    if (!sent) {
      sent = true;
      res.status(500).json({ error: "Webhook failed" });
    }
  }
}

export default function handler(req: ServerlessRequest, res: ServerlessResponse) {
  return handleSubscriptionWebhook(req, res);
}

export const config = {
  api: { bodyParser: false },
};
