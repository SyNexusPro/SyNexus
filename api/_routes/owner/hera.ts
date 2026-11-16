import type { IncomingMessage, ServerResponse } from "node:http";
import { ownerFromAccessToken } from "../../../lib/server/ownerSession.js";
import {
  notifyOwnerHera,
  readOwnerHeraThread,
  recordOwnerHeraAccess,
  saveOwnerHeraPush,
  writeOwnerHeraThread,
} from "../../../lib/server/owner/heraDirect.js";
import { sanitizeOwnerHeraTurns } from "../../../lib/ownerHeraThread.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function send(res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function bearer(authorization: string | string[] | undefined): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = raw?.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() || null;
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

function routeOf(url: string | undefined): string {
  const parsed = new URL(url ?? "/", "http://localhost");
  return parsed.searchParams.get("__route") || parsed.pathname;
}

export async function handleOwnerHera(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  const token = bearer(req.headers.authorization);
  if (!token) return send(res, 401, { error: "Sign in with the owner account." });
  const owner = await ownerFromAccessToken(token, env);
  if (!owner.ok) return send(res, owner.status, { error: owner.error });

  const route = routeOf(req.url);
  if (route.endsWith("/thread")) {
    if (req.method === "GET") {
      const turns = await readOwnerHeraThread(env, owner.userId);
      return send(res, 200, { turns });
    }
    if (req.method === "PUT") {
      const body = await readJson(req);
      const saved = await writeOwnerHeraThread(env, owner.userId, sanitizeOwnerHeraTurns(body.turns));
      return send(res, saved ? 200 : 503, saved ? { ok: true } : { error: "The conversation ledger is not connected." });
    }
    return send(res, 405, { error: "Method not allowed" });
  }

  if (route.endsWith("/push")) {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const body = await readJson(req);
    if (body.test === true) {
      const sent = await notifyOwnerHera(env, "Hera", "Hera can reach this phone.");
      return send(res, sent ? 200 : 503, sent ? { ok: true } : { error: "Push is not ready for this phone yet." });
    }
    const keys = body.keys as { p256dh?: string; auth?: string } | undefined;
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    const p256dh = keys?.p256dh?.trim() ?? "";
    const authKey = keys?.auth?.trim() ?? "";
    if (!endpoint || !p256dh || !authKey) return send(res, 400, { error: "Missing push subscription." });
    const saved = await saveOwnerHeraPush(env, owner.userId, { endpoint, p256dh, auth: authKey });
    return send(res, saved ? 200 : 503, saved ? { ok: true } : { error: "Push storage is not connected." });
  }

  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  await recordOwnerHeraAccess(env, owner.userId, "open");
  send(res, 200, { ok: true, vapidPublicKey: env.VAPID_PUBLIC_KEY?.trim() || null });
}

export function configureOwnerHeraApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await handleOwnerHera(req, res, env);
  };
  useApiRoute(server, "/api/owner/hera", middleware);
  useApiRoute(server, "/api/owner/hera/thread", middleware);
  useApiRoute(server, "/api/owner/hera/push", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleOwnerHera(req, res, process.env);
}
