import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveTitanAuthPlan } from "../../../lib/server/titan/authPlan.js";
import {
  decideSharedLesson,
  forgetPersonalMemory,
  proposeLesson,
  readHeraMind,
  savePersonalNote,
  setHeraMindConsent,
} from "../../../lib/server/hera/mindStore.js";
import { canApproveSharedLesson, personalNoteFromUtterance } from "../../../lib/server/hera/unifiedMind.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
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

export async function handleHeraMind(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  const auth = await resolveTitanAuthPlan(req, env);
  if (!auth.authenticated || !auth.userId) return send(res, 401, { error: "Sign in to use Hera's memory." });

  if (req.method === "GET") {
    const mind = await readHeraMind(env, auth.userId, auth.owner === true);
    return send(res, 200, {
      personalMemory: mind.personalMemory,
      sharedLearning: mind.sharedLearning,
      personalNotes: mind.personalNotes,
      sharedLessons: mind.sharedLessons,
      proposals: mind.proposals,
      available: mind.available,
    });
  }

  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const body = await readJson(req);
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "consent") {
    const saved = await setHeraMindConsent(env, auth.userId, {
      personalMemory: body.personalMemory === true,
      sharedLearning: body.sharedLearning === true,
    });
    return send(res, saved ? 200 : 503, saved ? { ok: true } : { error: "Memory storage is not connected." });
  }

  if (action === "remember") {
    const note = personalNoteFromUtterance(typeof body.note === "string" ? body.note : "");
    if (!note) return send(res, 400, { error: "That note is not a safe personal preference." });
    const saved = await savePersonalNote(env, auth.userId, note);
    return send(res, saved ? 200 : 409, saved ? { ok: true } : { error: "Personal memory is off." });
  }

  if (action === "forget") {
    const saved = await forgetPersonalMemory(env, auth.userId);
    return send(res, saved ? 200 : 503, saved ? { ok: true } : { error: "Memory storage is not connected." });
  }

  if (action === "propose") {
    const result = await proposeLesson(env, auth.userId, typeof body.lesson === "string" ? body.lesson : "");
    if (result === "unavailable") return send(res, 503, { error: "Memory storage is not connected." });
    if (result === "rejected") return send(res, 400, { error: "That cannot become a shared lesson." });
    return send(res, 200, { ok: true, status: "proposed" });
  }

  if (action === "decide") {
    if (!canApproveSharedLesson(auth.owner === true)) return send(res, 403, { error: "Only the owner can approve shared learning." });
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return send(res, 400, { error: "Missing lesson." });
    const saved = await decideSharedLesson(env, id, body.approve === true);
    return send(res, saved ? 200 : 409, saved ? { ok: true } : { error: "That lesson was not approved." });
  }

  return send(res, 400, { error: "Unknown action." });
}

export function configureHeraMindApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await handleHeraMind(req, res, env);
  };
  useApiRoute(server, "/api/hera/mind", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleHeraMind(req, res, process.env);
}
