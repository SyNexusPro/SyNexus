/**
 * GET /api/hera/live-token?mint=&symbol=
 * Verified DexScreener snapshot for Hera's LIVE stamp. No secrets.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { fetchVerifiedTokenSnapshot, SYN_MINT_DEFAULT } from "../../lib/server/titan/liveTokenIntel.js";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function query(req: IncomingMessage): URLSearchParams {
  try {
    const host = req.headers.host || "localhost";
    return new URL(req.url || "/", `http://${host}`).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export async function handleHeraLiveToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const params = query(req);
  const symbol = params.get("symbol")?.trim() || undefined;
  const requestedMint = params.get("mint")?.trim() || undefined;
  const mint =
    requestedMint ||
    (!symbol || symbol.toUpperCase() === "SYN" ? SYN_MINT_DEFAULT : undefined);
  const timeZone = params.get("tz")?.trim() || null;
  const snapshot = await fetchVerifiedTokenSnapshot({
    mint,
    symbol: symbol?.toUpperCase() === "SYN" ? "SYN" : symbol,
    timeZone,
  });
  sendJson(res, snapshot.meta.ok ? 200 : 502, snapshot.meta);
}

export function configureHeraLiveTokenApi(server: ViteDevServer): void {
  server.middlewares.use("/api/hera/live-token", async (req, res, next) => {
    const method = (req as IncomingMessage).method;
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      next();
      return;
    }
    await handleHeraLiveToken(req as IncomingMessage, res as ServerResponse);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraLiveToken(req, res);
}
