import type { IncomingMessage, ServerResponse } from "node:http";
import { ownerFromAccessToken } from "../../../lib/server/ownerSession.js";
import { monthSpendUsd } from "../../../lib/server/heraDeveloper/store.js";
import { dispatchWorkforce, organizationReady, workforceRoster } from "../../../lib/server/hera/olympus.js";
import {
  decideOlympusTask,
  enqueueOlympusTask,
  readOlympusState,
  roleStatus,
  setOlympusHalted,
} from "../../../lib/server/hera/olympusStore.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function bearer(authorization: string | string[] | undefined): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  return raw?.match(/^Bearer\s+(\S+)/i)?.[1]?.trim() || null;
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

export async function handleOwnerOlympus(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  const token = bearer(req.headers.authorization);
  if (!token) return send(res, 401, { error: "Sign in with the owner account." });
  const owner = await ownerFromAccessToken(token, env);
  if (!owner.ok) return send(res, owner.status, { error: owner.error });

  const roster = workforceRoster();
  const state = await readOlympusState(env);
  if (req.method === "GET") {
    const spent = (await monthSpendUsd(env).catch(() => null)) ?? null;
    const divisions = [...new Set(roster.map((role) => role.division))].map((name) => ({
      name,
      roles: roster
        .filter((role) => role.division === name)
        .map((role) => ({
          id: role.id,
          role: role.role,
          agent: role.agent,
          status: roleStatus(role, state.tasks, state.halted),
          gate: role.gate,
        })),
    }));
    return send(res, 200, {
      commander: "Hera",
      seats: roster.length,
      ready: organizationReady(),
      halted: state.halted,
      available: state.available,
      agents: [...new Set(roster.flatMap((role) => (role.agent ? [role.agent] : [])))],
      divisions,
      tasks: state.tasks,
      expensesUsd: spent,
    });
  }
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const body = await readJson(req);
  const action = typeof body.action === "string" ? body.action : "enqueue";
  if (action === "shutdown" || action === "resume") {
    const saved = await setOlympusHalted(env, action === "shutdown");
    return send(res, saved ? 200 : 503, saved ? { halted: action === "shutdown" } : { error: "Olympus storage is not connected." });
  }
  if (action === "decide") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return send(res, 400, { error: "Missing assignment." });
    const saved = await decideOlympusTask(env, id, body.approve === true);
    return send(res, saved ? 200 : 503, { ok: saved, deploy: false });
  }
  const task = typeof body.task === "string" ? body.task.trim().slice(0, 300) : "";
  if (!task) return send(res, 400, { error: "Tell Hera what the organization should look at." });
  const spent = (await monthSpendUsd(env).catch(() => 0)) ?? 0;
  const result = dispatchWorkforce(task, env, spent, state.halted);
  const queued = result.ok ? await enqueueOlympusTask(env, task, state.halted) : "halted";
  send(res, result.ok ? 200 : 403, { ...result, queued, deploy: false });
}

export function configureOwnerOlympusApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await handleOwnerOlympus(req, res, env);
  };
  useApiRoute(server, "/api/owner/olympus", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleOwnerOlympus(req, res, process.env);
}
