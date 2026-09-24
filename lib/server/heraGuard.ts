import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveTitanAuthPlan, type TitanAuthPlan } from "./titan/authPlan.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  return req.socket.remoteAddress ?? "unknown";
}

function takeToken(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true };
}

export function sendHeraJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/** Voice mint is billed to OPENAI_API_KEY — require a real Supabase user. */
export async function requireHeraUser(
  req: IncomingMessage,
  res: ServerResponse,
  env: Record<string, string | undefined>,
): Promise<TitanAuthPlan | null> {
  const auth = await resolveTitanAuthPlan(req, env);
  if (!auth.authenticated || !auth.userId) {
    sendHeraJson(res, 401, { error: "sign_in_required" });
    return null;
  }

  const hour = 60 * 60 * 1000;
  const userLimit = auth.plan === "PRO" ? 40 : 8;
  const user = takeToken(`hera:user:${auth.userId}`, userLimit, hour);
  if (!user.ok) {
    sendHeraJson(res, 429, { error: "rate_limited", retryAfterSec: user.retryAfterSec });
    return null;
  }

  const ip = takeToken(`hera:ip:${clientIp(req)}`, 20, hour);
  if (!ip.ok) {
    sendHeraJson(res, 429, { error: "rate_limited", retryAfterSec: ip.retryAfterSec });
    return null;
  }

  return auth;
}
