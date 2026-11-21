import type { IncomingMessage, ServerResponse } from "node:http";
import { productTier, profilePlanForTier, webhookAuthorized } from "../../../lib/server/membership/policy.js";
import { recordStoreEvent, syncProfilePlan } from "../../../lib/server/membership/store.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function statusFor(type: string): string | null {
  if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "SUBSCRIPTION_EXTENDED"].includes(type)) return "active";
  if (type === "CANCELLATION") return "canceled";
  if (type === "EXPIRATION" || type === "REFUND") return "expired";
  if (type === "BILLING_ISSUE") return "billing_issue";
  return null;
}

async function readJson(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function handleRevenueCatWebhook(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const secret = env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim() ?? "";
  if (!secret) return send(res, 503, { error: "Webhook authorization is not configured." });
  const header = req.headers.authorization;
  if (!webhookAuthorized(Array.isArray(header) ? header[0] : header, secret)) {
    return send(res, 401, { error: "Unauthorized webhook." });
  }
  const body = await readJson(req);
  const event = (body.event ?? {}) as { type?: string; app_user_id?: string; product_id?: string; expiration_at_ms?: number | null };
  const status = statusFor(event.type?.trim() ?? "");
  const userId = event.app_user_id?.trim() ?? "";
  if (!status || !UUID.test(userId)) return send(res, 200, { received: true, applied: false });
  const productId = event.product_id?.trim() || null;
  if (productId && !productTier(productId)) return send(res, 200, { received: true, applied: false });
  const expiresAt = typeof event.expiration_at_ms === "number" ? new Date(event.expiration_at_ms).toISOString() : null;
  const saved = await recordStoreEvent(env, { userId, productId, status, expiresAt });
  send(res, saved ? 200 : 503, { received: true, applied: saved });
}

export function configureRevenueCatWebhook(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await handleRevenueCatWebhook(req, res, env);
  };
  useApiRoute(server, "/api/revenuecat/webhook", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleRevenueCatWebhook(req, res, process.env);
}
