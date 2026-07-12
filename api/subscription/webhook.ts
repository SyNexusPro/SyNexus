import type { ViteDevServer } from "vite";
import { handleCreemWebhookRequest } from "../creem/webhook";
import { handleStripeWebhookRequest } from "../stripe/webhook";

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

async function dispatchWebhook(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  env: WebhookEnv,
) {
  const stripeSignature = getHeaderValue(headers["stripe-signature"]);
  if (stripeSignature) {
    return handleStripeWebhookRequest(rawBody, stripeSignature, env);
  }

  const creemSignature = getHeaderValue(headers["creem-signature"]);
  if (creemSignature) {
    return handleCreemWebhookRequest(rawBody, creemSignature, env);
  }

  return { statusCode: 400, body: { error: "Unknown webhook provider" } };
}

function registerWebhookRoute(server: ViteDevServer, path: string, env: WebhookEnv) {
  server.middlewares.use(path, async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      const rawBody = await readRawBody(req);
      const result = await dispatchWebhook(rawBody, req.headers, env);
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

/** Registers /api/webhook plus legacy provider paths for dev. */
export function configureSubscriptionWebhookApi(server: ViteDevServer, env: WebhookEnv) {
  for (const path of ["/api/webhook", "/api/stripe/webhook", "/api/creem/webhook"]) {
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

    const result = await dispatchWebhook(rawBody, req.headers, process.env);
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
