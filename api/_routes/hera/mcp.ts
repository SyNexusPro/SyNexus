/**
 * POST /api/hera/mcp
 * Approved read-only tools. Same bearer key as /api/hera/intel. No trading tools.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { defaultRunners, type ApprovedRunners } from "../../../lib/server/hera/approvedTools.js";
import { dispatchMcp } from "../../../lib/server/hera/mcpServer.js";
import { authorizeHeraIntel, type HeraIntelEnv } from "../../../lib/server/hera/partnerAuth.js";
import { useApiRoute, type ViteDevServer } from "../viteDevServer.js";

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (status === 405) res.setHeader("Allow", "POST");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > 16_000) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function handleHeraMcp(
  req: IncomingMessage,
  res: ServerResponse,
  env: HeraIntelEnv,
  runners: ApprovedRunners = defaultRunners(env),
): Promise<void> {
  if (req.method !== "POST") {
    req.resume();
    send(res, 405, { ok: false, error: "method_not_allowed", executesTrades: false, walletSigning: false });
    return;
  }
  const auth = authorizeHeraIntel(req.headers.authorization, env);
  if (!auth.ok) {
    req.resume();
    send(res, auth.status, { ok: false, error: auth.error, executesTrades: false, walletSigning: false });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    send(res, 400, { ok: false, error: "invalid_json", executesTrades: false, walletSigning: false });
    return;
  }
  const result = await dispatchMcp(parsed, runners);
  send(res, result.status, result.json);
}

export function configureHeraMcpApi(server: ViteDevServer, env: HeraIntelEnv): void {
  useApiRoute(server, "/api/hera/mcp", async (req, res) => {
    await handleHeraMcp(req, res, env);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraMcp(req, res, process.env);
}
