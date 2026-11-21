import type { IncomingMessage, ServerResponse } from "node:http";
import { integrationPresence } from "../../../lib/server/owner/integrationStatus.js";
import { ownerFromAccessToken } from "../../../lib/server/ownerSession.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function bearerFrom(authorization: string | string[] | undefined): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() || null;
}

export async function handleOwnerIntegrations(
  authorization: string | string[] | undefined,
  env: Env,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const token = bearerFrom(authorization);
  if (!token) return { statusCode: 401, body: { error: "Sign in with the owner account." } };
  const owner = await ownerFromAccessToken(token, env);
  if (!owner.ok) return { statusCode: owner.status, body: { error: owner.error } };
  return {
    statusCode: 200,
    body: {
      ok: true,
      guarantee: false,
      integrations: integrationPresence(env),
      note: "Configured means the variable is present. It does not by itself prove the upstream service answered.",
    },
  };
}

function send(
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void },
  result: { statusCode: number; body: Record<string, unknown> },
) {
  res.statusCode = result.statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(result.body));
}

export function configureOwnerIntegrationsApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    send(res, await handleOwnerIntegrations(req.headers.authorization, env));
  };
  useApiRoute(server, "/api/owner/integrations", middleware);
}

type ServerlessRequest = { method?: string; headers?: { authorization?: string | string[] } };
type ServerlessResponse = {
  status?(statusCode: number): ServerlessResponse;
  json?(body: unknown): void;
  statusCode?: number;
  setHeader?(name: string, value: string): void;
  end?(body?: string): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== "GET") {
    if (typeof res.status === "function") {
      res.status(405).json?.({ error: "Method not allowed" });
      return;
    }
    res.statusCode = 405;
    res.end?.(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  const result = await handleOwnerIntegrations(req.headers?.authorization, process.env);
  if (typeof res.status === "function") {
    res.status(result.statusCode).json?.(result.body);
    return;
  }
  res.statusCode = result.statusCode;
  res.setHeader?.("Content-Type", "application/json");
  res.setHeader?.("Cache-Control", "no-store");
  res.end?.(JSON.stringify(result.body));
}
