/**
 * POST /api/hera/ingest
 * Alexus -> Hera, one way. Stores the bot's redacted learning reports so Hera can learn from real outcomes.
 *
 * Auth (both required, constant time): Authorization: Bearer <HERA_INGEST_TOKEN> and
 * x-alexus-signature: sha256=<HMAC-SHA256(HERA_INGEST_TOKEN, raw body)>.
 *
 * The reply never carries an instruction. This route cannot trade, cannot sign, and does not talk to Alexus
 * beyond acknowledging receipt.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { useApiRoute, type ViteDevServer } from "../viteDevServer.js";
import {
  authorizeHeraIngestBearer,
  verifyHeraIngestSignature,
} from "../../../lib/server/hera/ingestAuth.js";
import {
  HERA_INGEST_MAX_BODY_BYTES,
  parseAlexusReport,
  type AlexusReport,
} from "../../../lib/server/hera/ingestPayload.js";
import { noteHeraIngestFailure, noteHeraIngestSuccess } from "../../../lib/server/hera/ingestRateLimit.js";
import type { HeraIntelEnv } from "../../../lib/server/hera/partnerAuth.js";
import { supabaseAdminFromEnv } from "../../../lib/server/titan/authPlan.js";

export type StoreResult = { ok: true } | { ok: false; reason: "storage_unconfigured" | "storage_not_ready" | "storage_unavailable" };

export type HeraIngestDeps = {
  store: (report: AlexusReport, meta: { scrubbed: number }, env: HeraIntelEnv) => Promise<StoreResult>;
};

const TABLE = "alexus_reports";

async function storeInSupabase(report: AlexusReport, meta: { scrubbed: number }, env: HeraIntelEnv): Promise<StoreResult> {
  const admin = supabaseAdminFromEnv(env as never);
  if (!admin) return { ok: false, reason: "storage_unconfigured" };
  const eventsCount = Object.values(report.events).reduce((sum, list) => sum + list.length, 0);
  const { error } = await admin.from(TABLE).upsert(
    {
      bot: report.bot,
      seq: report.seq,
      report_at: report.reportAt,
      scrubbed_values: meta.scrubbed,
      events_count: eventsCount,
      snapshot: report.snapshot,
      events: report.events,
      note: report.note,
    },
    // A resent report is a no-op. The same seq with a different report time is a restarted counter: stored.
    { onConflict: "bot,seq,report_at", ignoreDuplicates: true },
  );
  if (!error) return { ok: true };
  const code = (error as { code?: string }).code ?? "";
  if (code === "PGRST205" || code === "42P01") return { ok: false, reason: "storage_not_ready" };
  return { ok: false, reason: "storage_unavailable" };
}

const defaultDeps: HeraIngestDeps = { store: storeInSupabase };

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (status === 405) res.setHeader("Allow", "POST");
  if (body && typeof body === "object" && "retryAfterSec" in body) {
    const retry = (body as { retryAfterSec?: unknown }).retryAfterSec;
    if (typeof retry === "number") res.setHeader("Retry-After", String(retry));
  }
  res.end(JSON.stringify(body));
}

function errorBody(error: string, extra: Record<string, unknown> = {}) {
  return { ok: false, error, executesTrades: false, walletSigning: false, ...extra };
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === "string") {
    const hop = raw.split(",")[0]?.trim() ?? "";
    if (hop && hop.length <= 80 && !/[\r\n]/.test(hop)) return hop;
  }
  return req.socket?.remoteAddress ?? "unknown";
}

function readLimitedBody(req: IncomingMessage): Promise<{ ok: true; text: string } | { ok: false }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > HERA_INGEST_MAX_BODY_BYTES) {
        settled = true;
        resolve({ ok: false });
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve({ ok: true, text: Buffer.concat(chunks).toString("utf8") });
    });
    req.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

export async function handleHeraIngest(
  req: IncomingMessage,
  res: ServerResponse,
  env: HeraIntelEnv,
  deps: HeraIngestDeps = defaultDeps,
): Promise<void> {
  if (req.method !== "POST") {
    req.resume();
    sendJson(res, 405, errorBody("method_not_allowed"));
    return;
  }

  const bearer = authorizeHeraIngestBearer(req.headers.authorization, env);
  if (!bearer.ok) {
    req.resume();
    if (bearer.status === 401) {
      const limited = noteHeraIngestFailure(clientIp(req));
      if (!limited.ok) {
        sendJson(res, 429, errorBody("rate_limited", { retryAfterSec: limited.retryAfterSec }));
        return;
      }
    }
    sendJson(res, bearer.status, errorBody(bearer.error));
    return;
  }

  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > HERA_INGEST_MAX_BODY_BYTES) {
    req.resume();
    sendJson(res, 413, errorBody("body_too_large"));
    return;
  }

  const limited = noteHeraIngestSuccess(bearer.keyId);
  if (!limited.ok) {
    req.resume();
    sendJson(res, 429, errorBody("rate_limited", { retryAfterSec: limited.retryAfterSec }));
    return;
  }

  let rawText: string;
  try {
    const body = await readLimitedBody(req);
    if (!body.ok) {
      sendJson(res, 413, errorBody("body_too_large"));
      return;
    }
    rawText = body.text;
  } catch {
    sendJson(res, 400, errorBody("invalid_body"));
    return;
  }

  if (!verifyHeraIngestSignature(req.headers["x-alexus-signature"], rawText, env)) {
    const failed = noteHeraIngestFailure(clientIp(req));
    if (!failed.ok) {
      sendJson(res, 429, errorBody("rate_limited", { retryAfterSec: failed.retryAfterSec }));
      return;
    }
    sendJson(res, 401, errorBody("bad_signature"));
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    sendJson(res, 400, errorBody("invalid_json"));
    return;
  }

  const parsed = parseAlexusReport(parsedJson);
  if (!parsed.ok) {
    sendJson(res, 400, errorBody("invalid_report", { reason: parsed.reason }));
    return;
  }

  try {
    const stored = await deps.store(parsed.report, { scrubbed: parsed.scrubbed }, env);
    if (!stored.ok) {
      // 503 keeps the report queued on Alexus's side; nothing is lost.
      sendJson(res, 503, errorBody(stored.reason));
      return;
    }
    sendJson(res, 200, {
      ok: true,
      received: true,
      seq: parsed.report.seq,
      scrubbedValues: parsed.scrubbed,
      executesTrades: false,
      walletSigning: false,
    });
  } catch {
    sendJson(res, 503, errorBody("storage_unavailable"));
  }
}

export function configureHeraIngestApi(server: ViteDevServer, env: HeraIntelEnv): void {
  useApiRoute(server, "/api/hera/ingest", async (req, res) => {
    await handleHeraIngest(req, res, env);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraIngest(req, res, process.env);
}
