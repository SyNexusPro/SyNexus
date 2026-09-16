import crypto from "node:crypto";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "./viteDevServer";

type OwnerEnv = {
  SYNEXUS_OWNER_EMAIL?: string;
  SYNEXUS_OWNER_PASSWORD?: string;
  SYNEXUS_OWNER_SIGNING_KEY?: string;
};

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

function signingKey(env: OwnerEnv): string {
  return env.SYNEXUS_OWNER_SIGNING_KEY?.trim() || env.SYNEXUS_OWNER_PASSWORD?.trim() || "";
}

function ownerConfigured(env: OwnerEnv): boolean {
  return Boolean(env.SYNEXUS_OWNER_EMAIL?.trim() && env.SYNEXUS_OWNER_PASSWORD?.trim());
}

function secretEqual(a: string, b: string): boolean {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

function issueGrant(email: string, env: OwnerEnv): { grant: string; expiresAt: number } | null {
  const key = signingKey(env);
  if (!key) return null;
  const expiresAt = Date.now() + GRANT_TTL_MS;
  const sig = crypto.createHmac("sha256", key).update(`${email}:${expiresAt}`).digest("hex");
  const grant = Buffer.from(JSON.stringify({ e: email, exp: expiresAt, sig })).toString("base64url");
  return { grant, expiresAt };
}

function verifyGrantToken(grant: string, env: OwnerEnv): boolean {
  const key = signingKey(env);
  if (!key) return false;
  try {
    const parsed = JSON.parse(Buffer.from(grant, "base64url").toString("utf8")) as {
      e?: string;
      exp?: number;
      sig?: string;
    };
    if (!parsed.e || !parsed.exp || !parsed.sig) return false;
    if (Date.now() > parsed.exp) return false;
    const expected = crypto.createHmac("sha256", key).update(`${parsed.e}:${parsed.exp}`).digest("hex");
    return secretEqual(parsed.sig, expected);
  } catch {
    return false;
  }
}

async function handleOwnerUnlock(
  payload: UnlockPayload,
  env: OwnerEnv,
): Promise<{ statusCode: number; body: JsonBody }> {
  if (!ownerConfigured(env)) {
    return {
      statusCode: 503,
      body: { error: "Owner access is not configured on this server." },
    };
  }

  const grant = payload.grant?.trim();
  if (grant) {
    if (!verifyGrantToken(grant, env)) {
      return { statusCode: 401, body: { error: "Command code expired or invalid." } };
    }
    return { statusCode: 200, body: { ok: true } };
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const expectedEmail = env.SYNEXUS_OWNER_EMAIL!.trim().toLowerCase();
  const expectedPassword = env.SYNEXUS_OWNER_PASSWORD!.trim();

  if (!email || !password) {
    return { statusCode: 400, body: { error: "Enter your command ID and key." } };
  }

  if (!secretEqual(email, expectedEmail) || !secretEqual(password, expectedPassword)) {
    return { statusCode: 401, body: { error: "Invalid command ID or key." } };
  }

  const issued = issueGrant(email, env);
  if (!issued) {
    return { statusCode: 500, body: { error: "Could not issue owner grant." } };
  }

  return {
    statusCode: 200,
    body: { ok: true, grant: issued.grant, expiresAt: issued.expiresAt },
  };
}

async function respondJson(
  req: NodeJS.ReadableStream,
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
  env: OwnerEnv,
) {
  try {
    const payload = JSON.parse(await readRequestBody(req)) as UnlockPayload;
    const result = await handleOwnerUnlock(payload, env);
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

  const result = await handleOwnerUnlock(payload, process.env);
  sendUnlockResult(res, result);
}
