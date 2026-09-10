/**
 * GET /api/hera/launch-watch
 * Live public launch + social-lead snapshot for Hera. No secrets.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import {
  formatLaunchWatchBrief,
  launchWatchMeta,
  scanLaunchWatch,
} from "../../lib/server/titan/launchWatchScan.js";

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

export async function handleHeraLaunchWatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  const tz = query(req).get("tz")?.trim() || null;
  try {
    const leads = await scanLaunchWatch(process.env);
    sendJson(res, 200, {
      ...launchWatchMeta(leads),
      brief: formatLaunchWatchBrief(leads, tz),
    });
  } catch (err) {
    sendJson(res, 502, {
      ok: false,
      source: "Launch watch",
      capturedAt: Date.now(),
      error: err instanceof Error ? err.message : "launch_watch_failed",
    });
  }
}

export function configureHeraLaunchWatchApi(server: ViteDevServer): void {
  server.middlewares.use("/api/hera/launch-watch", async (req, res, next) => {
    const method = (req as IncomingMessage).method;
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      next();
      return;
    }
    await handleHeraLaunchWatch(req as IncomingMessage, res as ServerResponse);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraLaunchWatch(req, res);
}
