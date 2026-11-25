import type { IncomingMessage, ServerResponse } from "node:http";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function send(res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

function headerValue(req: IncomingMessage, name: string): string {
  const raw = req.headers[name];
  return Array.isArray(raw) ? (raw[0] ?? "").trim() : (raw ?? "").trim();
}

/**
 * Returns the visitor country from CDN headers when present.
 * Omits a country code when unknown so the client can let Paddle auto-detect from IP.
 */
export async function handlePaddleGeo(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });

  const country =
    headerValue(req, "x-vercel-ip-country") ||
    headerValue(req, "cf-ipcountry") ||
    headerValue(req, "x-country-code");

  const normalized = country.toUpperCase();
  if (!normalized || normalized === "XX" || normalized === "T1" || normalized === "OTHERS") {
    return send(res, 200, { country: null });
  }

  send(res, 200, { country: normalized });
}

export function configurePaddleGeo(server: ViteDevServer, _env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await handlePaddleGeo(req, res);
  };
  useApiRoute(server, "/api/paddle/geo", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handlePaddleGeo(req, res);
}
