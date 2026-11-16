import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveMembership } from "../../../lib/server/membership/resolve.js";
import { startComplimentaryTrial } from "../../../lib/server/membership/store.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function send(res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

export async function handleMembership(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  const membership = await resolveMembership(req, env);
  if (!membership.authenticated) return send(res, 401, { error: "Sign in to see membership." });
  send(res, 200, membership);
}

export async function handleMembershipTrial(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const membership = await resolveMembership(req, env);
  if (!membership.authenticated || !membership.userId) return send(res, 401, { error: "Sign in to start the trial." });
  if (membership.owner) return send(res, 200, { ...membership, trial: "owner" });
  if (membership.source === "revenuecat") return send(res, 409, { error: "A store subscription is already active." });
  const result = await startComplimentaryTrial(env, membership.userId);
  if (result === "unavailable") return send(res, 503, { error: "The trial ledger is not connected." });
  if (result === "used") return send(res, 409, { error: "The 30-day trial can only be used once." });
  const next = await resolveMembership(req, env);
  send(res, 200, { ...next, trial: "started" });
}

export async function handleMembershipRestore(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const membership = await resolveMembership(req, env);
  if (!membership.authenticated) return send(res, 401, { error: "Sign in to restore purchases." });
  send(res, 200, membership);
}

function routeOf(url: string | undefined): string {
  const parsed = new URL(url ?? "/", "http://localhost");
  return parsed.searchParams.get("__route") || parsed.pathname;
}

async function dispatch(req: IncomingMessage, res: ServerResponse, env: Env) {
  const route = routeOf(req.url);
  if (route.endsWith("/trial")) return handleMembershipTrial(req, res, env);
  if (route.endsWith("/restore")) return handleMembershipRestore(req, res, env);
  return handleMembership(req, res, env);
}

export function configureMembershipApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await dispatch(req, res, env);
  };
  useApiRoute(server, "/api/membership", middleware);
  useApiRoute(server, "/api/membership/trial", middleware);
  useApiRoute(server, "/api/membership/restore", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return dispatch(req, res, process.env);
}
