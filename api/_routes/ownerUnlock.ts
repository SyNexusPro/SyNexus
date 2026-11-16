import { signOwnerGrant } from "../../lib/server/ownerGrant.js";
import {
  ownerFromAccessToken,
  ownerFromPassword,
  type OwnerCheck,
  type OwnerEnv,
} from "../../lib/server/ownerSession.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "./viteDevServer.js";

type UnlockPayload = {
  email?: string;
  password?: string;
  grant?: string;
};

type JsonBody = {
  ok?: boolean;
  grant?: string;
  expiresAt?: number;
  error?: string;
};

const GRANT_TTL_MS = 90 * 86_400_000;

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

type OwnerUnlockDeps = {
  verifyAccessToken: (token: string, env: OwnerEnv) => Promise<OwnerCheck>;
  verifyPassword: (email: string, password: string, env: OwnerEnv) => Promise<OwnerCheck>;
};

const defaultDeps: OwnerUnlockDeps = {
  verifyAccessToken: ownerFromAccessToken,
  verifyPassword: ownerFromPassword,
};

function bearerFrom(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() || null;
}

function issueGrant(email: string, env: OwnerEnv): { grant: string; expiresAt: number } | null {
  const expiresAt = Date.now() + GRANT_TTL_MS;
  const grant = signOwnerGrant(email, expiresAt, env);
  return grant ? { grant, expiresAt } : null;
}

export async function handleOwnerUnlock(
  payload: UnlockPayload,
  env: OwnerEnv,
  authorization?: string | null,
  deps: OwnerUnlockDeps = defaultDeps,
): Promise<{ statusCode: number; body: JsonBody }> {
  const token = bearerFrom(authorization);
  const email = payload.email?.trim() ?? "";
  const password = payload.password ?? "";

  let check: OwnerCheck | null = null;
  if (token) check = await deps.verifyAccessToken(token, env);
  else if (email || password) check = await deps.verifyPassword(email, password, env);
  else return { statusCode: 400, body: { error: "Sign in with the owner account." } };

  if (check && !check.ok) return { statusCode: check.status, body: { error: check.error } };
  if (!check) return { statusCode: 401, body: { error: "Sign in with the owner account." } };

  const issued = issueGrant(check.email, env);
  if (!issued) {
    return { statusCode: 503, body: { error: "Owner signing key is not configured on this server." } };
  }

  return {
    statusCode: 200,
    body: { ok: true, grant: issued.grant, expiresAt: issued.expiresAt },
  };
}

async function respondJson(
  req: NodeJS.ReadableStream & { headers?: { authorization?: string | string[] } },
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
  env: OwnerEnv,
) {
  try {
    const rawAuth = req.headers?.authorization;
    const authorization = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    const raw = await readRequestBody(req);
    const payload = (raw.trim() ? JSON.parse(raw) : {}) as UnlockPayload;
    const result = await handleOwnerUnlock(payload, env, authorization);
    res.statusCode = result.statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result.body));
  } catch {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Owner unlock unavailable." }));
  }
}

export function configureOwnerUnlockApi(server: ViteDevServer, env: OwnerEnv) {
  const middleware: ConnectHandler = async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    await respondJson(req, res, env);
  };
  useApiRoute(server, "/api/owner-unlock", middleware);
  useApiRoute(server, "/api/ownerUnlock", middleware);
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  body?: unknown;
  headers?: { authorization?: string | string[] };
};

type ServerlessResponse = {
  status?(statusCode: number): ServerlessResponse;
  json?(body: unknown): void;
  statusCode?: number;
  setHeader?(name: string, value: string): void;
  end?(body?: string): void;
};

function sendUnlockResult(
  res: ServerlessResponse & Partial<{ statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void }>,
  result: { statusCode: number; body: JsonBody },
) {
  if (typeof res.status === "function") {
    const reply = res.status(result.statusCode);
    if (typeof reply.json === "function") {
      reply.json(result.body);
      return;
    }
  }
  res.statusCode = result.statusCode;
  res.setHeader?.("Content-Type", "application/json");
  res.end?.(JSON.stringify(result.body));
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== "POST") {
    sendUnlockResult(res, { statusCode: 405, body: { error: "Method not allowed" } });
    return;
  }

  let payload: UnlockPayload = {};
  try {
    if (typeof req.body === "string" && req.body.trim()) {
      payload = JSON.parse(req.body) as UnlockPayload;
    } else if (req.body && typeof req.body === "object" && Object.keys(req.body as object).length) {
      payload = req.body as UnlockPayload;
    } else {
      const raw = await readRequestBody(req);
      payload = raw.trim() ? (JSON.parse(raw) as UnlockPayload) : {};
    }
  } catch {
    sendUnlockResult(res, { statusCode: 400, body: { error: "Invalid request" } });
    return;
  }

  const rawAuth = req.headers?.authorization;
  const authorization = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  const result = await handleOwnerUnlock(payload, process.env, authorization);
  sendUnlockResult(res, result);
}
