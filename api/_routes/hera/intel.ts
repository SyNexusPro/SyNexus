/**
 * POST /api/hera/intel
 * Server-to-server token intelligence for Alexus. Advisory only.
 * Auth: Authorization: Bearer <SYNEXUS_TITAN_API_KEY>
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { useApiRoute, type ViteDevServer } from "../viteDevServer.js";
import { buildHeraIntelReport } from "../../../lib/server/hera/intelReport.js";
import { noteHeraIntelFailure, noteHeraIntelSuccess } from "../../../lib/server/hera/intelRateLimit.js";
import { loadMarketReading, loadSecurityReading, type MarketReading, type SecurityReading } from "../../../lib/server/hera/intelSources.js";
import { authorizeHeraIntel, type HeraIntelEnv } from "../../../lib/server/hera/partnerAuth.js";
import { parseSolanaMint } from "../../../lib/server/hera/solanaMint.js";

const MAX_BODY_BYTES = 4096;
const ALLOWED_FIELDS = new Set(["mint", "symbol", "chain"]);

export type HeraIntelDeps = {
  loadMarket: (mint: string) => Promise<MarketReading>;
  loadSecurity: (mint: string, env: HeraIntelEnv) => Promise<SecurityReading>;
};

const defaultDeps: HeraIntelDeps = {
  loadMarket: (mint) => loadMarketReading(mint),
  loadSecurity: (mint, env) => loadSecurityReading(mint, env),
};

type IntelRequest =
  | { ok: true; mint: string; symbol: string | null }
  | { ok: false; reason: "mint_required" | "invalid_mint" | "invalid_symbol" | "unsupported_chain" | "unexpected_field"; field?: string };

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (status === 429 && body && typeof body === "object" && "retryAfterSec" in body) {
    const retry = (body as { retryAfterSec?: unknown }).retryAfterSec;
    if (typeof retry === "number") res.setHeader("Retry-After", String(retry));
  }
  if (status === 405) res.setHeader("Allow", "POST");
  res.end(payload);
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

function readLimitedBody(req: IncomingMessage): Promise<{ ok: true; text: string } | { ok: false; error: "body_too_large" }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: { ok: true; text: string } | { ok: false; error: "body_too_large" }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
        finish({ ok: false, error: "body_too_large" });
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => finish({ ok: true, text: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

export function parseIntelRequest(raw: unknown): IntelRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "mint_required" };
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) continue;
    return {
      ok: false,
      reason: "unexpected_field",
      field: /^[A-Za-z0-9_]{1,40}$/.test(key) ? key : undefined,
    };
  }
  if (!("mint" in body) || body.mint == null || body.mint === "") return { ok: false, reason: "mint_required" };
  const mint = parseSolanaMint(body.mint);
  if (!mint) return { ok: false, reason: "invalid_mint" };
  let symbol: string | null = null;
  if (body.symbol != null && body.symbol !== "") {
    if (typeof body.symbol !== "string" || !/^[A-Za-z0-9]{1,16}$/.test(body.symbol)) {
      return { ok: false, reason: "invalid_symbol" };
    }
    symbol = body.symbol.toUpperCase();
  }
  if (body.chain != null && body.chain !== "") {
    if (typeof body.chain !== "string" || body.chain.trim().toLowerCase() !== "solana") {
      return { ok: false, reason: "unsupported_chain" };
    }
  }
  return { ok: true, mint, symbol };
}

function errorBody(error: string, extra: Record<string, unknown> = {}) {
  return { ok: false, error, advisoryOnly: true, executesTrades: false, walletSigning: false, ...extra };
}

function releaseUnreadBody(req: IncomingMessage): void {
  req.resume();
}

export async function handleHeraIntel(
  req: IncomingMessage,
  res: ServerResponse,
  env: HeraIntelEnv,
  deps: HeraIntelDeps = defaultDeps,
): Promise<void> {
  if (req.method !== "POST") {
    releaseUnreadBody(req);
    sendJson(res, 405, errorBody("method_not_allowed"));
    return;
  }

  const auth = authorizeHeraIntel(req.headers.authorization, env);
  if (!auth.ok) {
    releaseUnreadBody(req);
    if (auth.status === 401) {
      const limited = noteHeraIntelFailure(clientIp(req));
      if (!limited.ok) {
        sendJson(res, 429, errorBody("rate_limited", { retryAfterSec: limited.retryAfterSec }));
        return;
      }
    }
    sendJson(res, auth.status, errorBody(auth.error));
    return;
  }

  const limited = noteHeraIntelSuccess(auth.keyId);
  if (!limited.ok) {
    releaseUnreadBody(req);
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
    sendJson(res, 400, errorBody("invalid_json"));
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    sendJson(res, 400, errorBody("invalid_json"));
    return;
  }

  const request = parseIntelRequest(parsedJson);
  if (!request.ok) {
    sendJson(res, 400, errorBody("invalid_request", {
      reason: request.reason,
      ...(request.field ? { field: request.field } : {}),
    }));
    return;
  }

  try {
    const [market, security] = await Promise.all([
      deps.loadMarket(request.mint),
      deps.loadSecurity(request.mint, env),
    ]);
    const report = buildHeraIntelReport({
      mint: request.mint,
      requestedSymbol: request.symbol,
      capturedAtMs: Date.now(),
      market,
      security,
    });
    sendJson(res, 200, report);
  } catch {
    sendJson(res, 502, errorBody("intel_unavailable"));
  }
}

export function configureHeraIntelApi(server: ViteDevServer, env: HeraIntelEnv): void {
  useApiRoute(server, "/api/hera/intel", async (req, res) => {
    await handleHeraIntel(req, res, env);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraIntel(req, res, process.env);
}
