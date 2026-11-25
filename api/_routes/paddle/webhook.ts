import type { IncomingMessage, ServerResponse } from "node:http";
import { readPaddleServerEnv } from "../../../lib/server/subscription/paddleEnv.js";
import {
  mapPaddleWebhookEvent,
  type PaddleWebhookEvent,
  verifyPaddleWebhookSignature,
} from "../../../lib/server/subscription/paddleWebhook.js";
import {
  applyWebhookEvent,
  type ApplyWebhookInput,
  type ApplyWebhookResult,
} from "../../../lib/server/membership/store.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

export type PaddleWebhookDeps = {
  applyEvent: (env: Env, input: ApplyWebhookInput) => Promise<ApplyWebhookResult>;
};

const defaultDeps: PaddleWebhookDeps = {
  applyEvent: applyWebhookEvent,
};

function send(res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readRawBody(req: IncomingMessage & { body?: unknown }): Promise<string> {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function signatureHeader(req: IncomingMessage): string {
  const value = req.headers["paddle-signature"];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function handlePaddleWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
  deps: PaddleWebhookDeps = defaultDeps,
): Promise<void> {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  const paddle = readPaddleServerEnv(env);
  if (!paddle) return send(res, 503, { error: "Paddle webhook is not configured." });

  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    console.error("[paddle/webhook] body read failed", error);
    return send(res, 400, { error: "Invalid body." });
  }

  if (!rawBody.trim() || !signatureHeader(req)) {
    return send(res, 400, { error: "Missing signature or body" });
  }

  if (!verifyPaddleWebhookSignature(rawBody, signatureHeader(req), paddle.webhookSecret)) {
    console.error("[paddle/webhook] signature verification failed");
    return send(res, 500, { error: "Internal error" });
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch (error) {
    console.error("[paddle/webhook] invalid json", error);
    return send(res, 400, { error: "Invalid JSON." });
  }

  const mapped = mapPaddleWebhookEvent(event, env);
  if (mapped.kind === "ignore") {
    return send(res, 200, { received: true, applied: false, reason: mapped.reason });
  }

  const result = await deps.applyEvent(env, mapped.input);
  if (result === "duplicate") return send(res, 200, { received: true, applied: false, duplicate: true });
  if (result === "unavailable") {
    console.error("[paddle/webhook] ledger unavailable", mapped.input.eventId);
    return send(res, 503, { error: "Webhook ledger unavailable." });
  }
  if (result === "failed") {
    console.error("[paddle/webhook] apply failed", mapped.input.eventType, mapped.input.userId, mapped.input.eventId);
    return send(res, 503, { received: true, applied: false });
  }

  send(res, 200, { received: true, applied: true });
}

export function configurePaddleWebhook(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await handlePaddleWebhook(req, res, env);
  };
  useApiRoute(server, "/api/paddle/webhook", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handlePaddleWebhook(req, res, process.env);
}
