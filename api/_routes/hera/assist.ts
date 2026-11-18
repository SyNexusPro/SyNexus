import type { IncomingMessage, ServerResponse } from "node:http";
import { requireHeraUser } from "../../../lib/server/heraGuard.js";
import { callApprovedTool, defaultRunners } from "../../../lib/server/hera/approvedTools.js";
import { readVoiceLatency, recordVoiceLatency } from "../../../lib/server/hera/voiceLatency.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;
type Incoming = IncomingMessage & { body?: unknown };

let assistEnv: Env = process.env;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: Incoming): Promise<Record<string, unknown>> {
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

function toolArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function handleHeraAssist(req: IncomingMessage, res: ServerResponse, env: Env = assistEnv): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  const auth = await requireHeraUser(req, res, env);
  if (!auth?.userId) {
    if (auth) send(res, 401, { error: "Sign in to use Hera." });
    return;
  }

  if (req.method === "GET") {
    const stats = await readVoiceLatency(env, auth.userId);
    send(res, 200, stats);
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await readJson(req);
  } catch {
    send(res, 400, { error: "Invalid request" });
    return;
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "latency") {
    const ms = typeof body.ms === "number" ? body.ms : Number.NaN;
    const saved = await recordVoiceLatency(env, auth.userId, ms);
    send(res, saved ? 200 : 503, saved ? { ok: true } : { error: "Latency was not stored." });
    return;
  }

  if (action === "tool") {
    const name = typeof body.name === "string" ? body.name : "";
    const result = await callApprovedTool(name, toolArgs(body.arguments), defaultRunners(env));
    if (!result.ok) {
      send(res, 400, { error: result.error, text: "That tool is not available. Do not invent a result." });
      return;
    }
    send(res, 200, { ok: true, text: result.text.slice(0, 4000) });
    return;
  }

  send(res, 400, { error: "Unknown action." });
}

export function configureHeraAssistApi(server: ViteDevServer, env: Env) {
  assistEnv = env;
  const middleware: ConnectHandler = async (req, res) => {
    await handleHeraAssist(req, res, env);
  };
  useApiRoute(server, "/api/hera/assist", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleHeraAssist(req, res, process.env);
}
