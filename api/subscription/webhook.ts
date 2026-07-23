import type { ViteDevServer } from "../viteDevServer";
import { handleSquareWebhookRequest } from "../../lib/server/square/webhook.js";

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

function registerWebhookRoute(server: ViteDevServer, path: string, env: WebhookEnv) {
  server.middlewares.use(path, async (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, service: "SyNexus Square webhook" }));
      return;
    }
    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      const rawBody = await readRawBody(req);
      const signature = getHeaderValue(req.headers["x-square-hmacsha256-signature"]);
      const result = await handleSquareWebhookRequest(rawBody, signature, env);
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

/** Registers /api/webhook and /api/square/webhook for dev. */
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
  json(body: unknown): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method === "GET" || req.method === "HEAD") {
    res.status(200).json({ ok: true, service: "SyNexus Square webhook" });
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
    const result = await handleSquareWebhookRequest(rawBody, signature, process.env);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process webhook",
    });
  }
}

export const config = {
  api: { bodyParser: false },
};
