import type { IncomingMessage, ServerResponse } from "node:http";
import { runDailyDeveloperReview } from "../owner/developer.js";
import { collectOwnerBrief } from "../../../lib/server/owner/briefCollect.js";
import { notifyOwnerHera } from "../../../lib/server/owner/heraDirect.js";
import { useApiRoute, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function authorize(req: IncomingMessage, env: Env): boolean {
  const secret = env.CRON_SECRET?.trim() || "";
  if (!secret) return false;
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const header = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
  return auth === `Bearer ${secret}` || header === secret;
}

export async function handleHeraDeveloperCron(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  if (!authorize(req, env)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  const result = await runDailyDeveloperReview(env);
  let notified = false;
  let olympus = "skipped";
  try {
    const brief = await collectOwnerBrief(env);
    const body = brief.spoken.trim().slice(0, 180) || "Your executive briefing is ready.";
    notified = await notifyOwnerHera(env, "Hera", body);
  } catch {
    notified = false;
  }
  try {
    const { readOlympusState, enqueueOlympusTask } = await import("../../../lib/server/hera/olympusStore.js");
    const state = await readOlympusState(env);
    olympus = await enqueueOlympusTask(env, "Daily organization review", state.halted);
  } catch {
    olympus = "unavailable";
  }
  res.statusCode = result.created || result.reason.includes("already") ? 200 : 503;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: result.created, deploy: false, reason: result.reason, notified, olympus }));
}

export function configureHeraDeveloperCron(server: ViteDevServer, env: Env) {
  useApiRoute(server, "/api/cron/hera-developer", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST") {
      next();
      return;
    }
    await handleHeraDeveloperCron(req, res, env);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraDeveloperCron(req, res, process.env);
}
