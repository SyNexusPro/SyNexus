import { cloudInvestigationGate, requestCloudInvestigation } from "../../../lib/server/heraDeveloper/cloudAgent.js";
import { buildDailyReview } from "../../../lib/server/heraDeveloper/review.js";
import {
  applyDeveloperDecision,
  insertDeveloperProposal,
  listDeveloperProposals,
  logDeveloperRun,
  monthSpendUsd,
  spokenDeveloperReport,
} from "../../../lib/server/heraDeveloper/store.js";
import { ownerFromAccessToken } from "../../../lib/server/ownerSession.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function bearer(authorization: string | string[] | undefined): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = raw?.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() || null;
}

function routeOf(url: string | undefined): string {
  const parsed = new URL(url ?? "/", "http://localhost");
  return parsed.searchParams.get("__route") || parsed.pathname;
}

async function readJson(req: NodeJS.ReadableStream & { body?: unknown }): Promise<Record<string, unknown>> {
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

function send(
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function handleDeveloperRoute(
  req: NodeJS.ReadableStream & { method?: string; url?: string; headers?: { authorization?: string | string[] }; body?: unknown },
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
  env: Env,
) {
  const token = bearer(req.headers?.authorization);
  if (!token) return send(res, 401, { error: "Sign in with the owner account." });
  const owner = await ownerFromAccessToken(token, env);
  if (!owner.ok) return send(res, owner.status, { error: owner.error });

  const route = routeOf(req.url);
  try {
    if (req.method === "GET" && route.endsWith("/report")) {
      const proposals = await listDeveloperProposals(env);
      if (!proposals) return send(res, 503, { error: "The developer log is not connected." });
      const spoken = spokenDeveloperReport(proposals);
      return send(res, 200, { ok: true, spoken, detail: spoken });
    }

    if (req.method === "GET") {
      const proposals = await listDeveloperProposals(env);
      if (!proposals) return send(res, 503, { error: "The developer log is not connected." });
      return send(res, 200, { ok: true, proposals });
    }

    if (req.method === "POST" && route.endsWith("/decision")) {
      const body = await readJson(req);
      const result = await applyDeveloperDecision(env, {
        proposalId: String(body.proposalId ?? ""),
        action: String(body.action ?? ""),
        testedSha: String(body.testedSha ?? ""),
        actorUserId: owner.userId,
        note: typeof body.note === "string" ? body.note : "",
      });
      return send(res, result.http, result.body);
    }

    if (req.method === "POST" && route.endsWith("/investigate")) {
      const body = await readJson(req);
      const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
      const spent = (await monthSpendUsd(env)) ?? 0;
      const gate = cloudInvestigationGate(env, spent);
      if (!gate.ok) {
        await logDeveloperRun(env, { kind: "cloud-agent", status: "refused", spendUsd: 0, detail: gate.reason });
        return send(res, 200, { ok: false, started: false, reason: gate.reason });
      }
      const launched = await requestCloudInvestigation(env, spent, note);
      if (!launched.ok) {
        await logDeveloperRun(env, { kind: "cloud-agent", status: "refused", spendUsd: 0, detail: launched.reason });
        return send(res, 200, { ok: false, started: false, reason: launched.reason });
      }
      await logDeveloperRun(env, {
        kind: "cloud-agent",
        status: "started",
        spendUsd: launched.reserveUsd,
        detail: "Plan-only cloud investigation. No merge and no deploy.",
      });
      return send(res, 200, { ok: true, started: true, deploy: false });
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch {
    return send(res, 500, { error: "Hera Developer is unavailable." });
  }
}

export async function runDailyDeveloperReview(env: Env, now = new Date()): Promise<{ created: boolean; reason: string }> {
  const day = now.toISOString().slice(0, 10);
  const proposals = await listDeveloperProposals(env);
  if (!proposals) return { created: false, reason: "The developer log is not connected." };
  if (proposals.some((item) => item.testedSha === `review-only-${day}`)) {
    return { created: false, reason: "Today's review already exists." };
  }
  const spent = (await monthSpendUsd(env)) ?? 0;
  const gate = cloudInvestigationGate(env, spent);
  const draft = buildDailyReview({
    day,
    cloudReason: gate.ok ? null : gate.reason,
    openCount: proposals.filter((item) => item.status === "proposed").length,
  });
  const id = await insertDeveloperProposal(env, draft);
  if (!id) return { created: false, reason: "The review could not be saved." };
  await logDeveloperRun(env, { kind: "daily-review", status: "recorded", spendUsd: 0, detail: "No code changed." });
  return { created: true, reason: "Review recorded. Nothing was deployed." };
}

export function configureOwnerDeveloperApi(server: ViteDevServer, env: Env) {
  const paths = ["/api/owner/developer/proposals", "/api/owner/developer/decision", "/api/owner/developer/report", "/api/owner/developer/investigate"];
  for (const path of paths) {
    const middleware: ConnectHandler = async (req, res, next) => {
      if (req.method !== "GET" && req.method !== "POST") {
        next();
        return;
      }
      await handleDeveloperRoute(req, res, env);
    };
    useApiRoute(server, path, middleware);
  }
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  url?: string;
  headers?: { authorization?: string | string[] };
  body?: unknown;
};

type ServerlessResponse = {
  status?(statusCode: number): { json?: (body: unknown) => void };
  statusCode?: number;
  setHeader?(name: string, value: string): void;
  end?(body?: string): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  const sink = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      res.setHeader?.(name, value);
    },
    end(body: string) {
      if (typeof res.status === "function") {
        const reply = res.status(sink.statusCode);
        if (typeof reply.json === "function") {
          reply.json(JSON.parse(body));
          return;
        }
      }
      res.statusCode = sink.statusCode;
      res.end?.(body);
    },
  };
  await handleDeveloperRoute(req, sink, process.env);
}
