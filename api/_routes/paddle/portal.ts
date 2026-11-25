import type { IncomingMessage, ServerResponse } from "node:http";
import { createCustomerPortalSession } from "../../../lib/server/subscription/paddleApi.js";
import { isPaddleServerConfigured } from "../../../lib/server/subscription/paddleEnv.js";
import { resolveMembership } from "../../../lib/server/membership/resolve.js";
import { readMembershipRecord } from "../../../lib/server/membership/store.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function send(res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

export async function handlePaddlePortal(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!isPaddleServerConfigured(env)) {
    return send(res, 503, { error: "Paddle portal is not configured." });
  }

  const membership = await resolveMembership(req, env);
  if (!membership.authenticated || !membership.userId) {
    return send(res, 401, { error: "Sign in to manage your subscription." });
  }

  const record = await readMembershipRecord(env, membership.userId);
  const customerId = record?.paddleCustomerId?.trim() || membership.paddleCustomerId?.trim() || "";
  if (!customerId) {
    return send(res, 404, {
      error: "No Paddle subscription is linked to this account yet. Complete checkout first.",
    });
  }

  const subscriptionIds = record?.paddleSubscriptionId ? [record.paddleSubscriptionId] : [];
  const result = await createCustomerPortalSession(env, customerId, subscriptionIds);
  if (!result.ok) return send(res, result.status, { error: result.error });
  send(res, 200, { url: result.url });
}

export function configurePaddlePortal(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await handlePaddlePortal(req, res, env);
  };
  useApiRoute(server, "/api/paddle/portal", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handlePaddlePortal(req, res, process.env);
}
