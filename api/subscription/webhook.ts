import type { ViteDevServer } from "../viteDevServer";
import { processSquareWebhookEvent } from "../../lib/server/square/webhook.js";

/** Browser GET test message — also used as plain-text health check. */
export const SQUARE_WEBHOOK_ACTIVE_MESSAGE = "Square webhook endpoint is active";

/** Production notification URL — must match Square Dashboard exactly. */
export const SQUARE_WEBHOOK_PUBLIC_URL = "https://synexus.pro/api/webhook";

type WebhookEnv = Record<string, string | undefined>;

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

function sendActiveMessage(res: { statusCode?: number; setHeader(name: string, value: string): void; end(body?: string): void }) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(SQUARE_WEBHOOK_ACTIVE_MESSAGE);
}

function acknowledgePost(res: { statusCode?: number; setHeader(name: string, value: string): void; end(body?: string): void }) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ received: true }));
}

function registerWebhookRoute(server: ViteDevServer, path: string, env: WebhookEnv) {
  server.middlewares.use(path, async (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") {
      sendActiveMessage(res);
      return;
    }

    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      const rawBody = await readRawBody(req);
      const signature = getHeaderValue(req.headers["x-square-hmacsha256-signature"]);
      void processSquareWebhookEvent(rawBody, signature, env).catch((error) => {
        console.error("[webhook]", error);
      });
    } catch (error) {
      console.error("[webhook]", error);
    }

    acknowledgePost(res);
  });
}

/** Registers /api/webhook and /api/square/webhook for Vite dev. */
export function configureSubscriptionWebhookApi(server: ViteDevServer, env: WebhookEnv) {
  for (const path of ["/api/webhook", "/api/square/webhook"]) {
    registerWebhookRoute(server, path, env);
  }
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

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
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

  try {
    const rawBody =
      typeof req.body === "string"
        ? Buffer.from(req.body, "utf8")
        : Buffer.isBuffer(req.body)
          ? req.body
          : await readRawBody(req);

    const signature = getHeaderValue(req.headers["x-square-hmacsha256-signature"]);
    void processSquareWebhookEvent(rawBody, signature, process.env).catch((error) => {
      console.error("[webhook]", error);
    });
  } catch (error) {
    console.error("[webhook]", error);
  }

  res.status(200).json({ received: true });
}

export const config = {
  api: { bodyParser: false },
};
