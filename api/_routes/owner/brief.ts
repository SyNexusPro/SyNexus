import { collectOwnerBrief } from "../../../lib/server/owner/briefCollect.js";
import { ownerFromAccessToken } from "../../../lib/server/ownerSession.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type BriefEnv = Record<string, string | undefined>;

function bearerFrom(authorization: string | string[] | undefined): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() || null;
}

export async function handleOwnerBrief(
  authorization: string | string[] | undefined,
  env: BriefEnv,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const token = bearerFrom(authorization);
  if (!token) return { statusCode: 401, body: { error: "Sign in with the owner account." } };

  const owner = await ownerFromAccessToken(token, env);
  if (!owner.ok) return { statusCode: owner.status, body: { error: owner.error } };

  const brief = await collectOwnerBrief(env);
  return {
    statusCode: 200,
    body: { ok: true, spoken: brief.spoken, detail: brief.detail },
  };
}

function send(
  res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (body: string) => void;
  },
  result: { statusCode: number; body: Record<string, unknown> },
) {
  res.statusCode = result.statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(result.body));
}

export function configureOwnerBriefApi(server: ViteDevServer, env: BriefEnv) {
  const middleware: ConnectHandler = async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST") {
      next();
      return;
    }
    const result = await handleOwnerBrief(req.headers.authorization, env);
    send(res, result);
  };
  useApiRoute(server, "/api/owner/brief", middleware);
}

type ServerlessRequest = {
  method?: string;
  headers?: { authorization?: string | string[] };
};

type ServerlessResponse = {
  status?(statusCode: number): ServerlessResponse;
  json?(body: unknown): void;
  statusCode?: number;
  setHeader?(name: string, value: string): void;
  end?(body?: string): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    if (typeof res.status === "function") {
      const reply = res.status(405);
      reply.json?.({ error: "Method not allowed" });
      return;
    }
    res.statusCode = 405;
    res.setHeader?.("Content-Type", "application/json");
    res.end?.(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const result = await handleOwnerBrief(req.headers?.authorization, process.env);
  if (typeof res.status === "function") {
    const reply = res.status(result.statusCode);
    if (typeof reply.json === "function") {
      reply.json(result.body);
      return;
    }
  }
  res.statusCode = result.statusCode;
  res.setHeader?.("Content-Type", "application/json");
  res.setHeader?.("Cache-Control", "no-store");
  res.end?.(JSON.stringify(result.body));
}
