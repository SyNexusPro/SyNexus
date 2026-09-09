import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "./viteDevServer";
import {
  attachReferral,
  getInviteStatus,
  submitIdentity,
  userFromBearer,
} from "../lib/server/invite/service.js";
import { confirmRecentCardPayment, createCardVerifyCheckout } from "../lib/server/square/cardVerify.js";

type InviteEnv = Record<string, string | undefined>;

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
  statusCode: number,
  body: unknown,
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  const raw = await readRequestBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

async function handleInvite(req: IncomingMessage, res: ServerResponse, env: InviteEnv): Promise<void> {
  const user = await userFromBearer(req, env);
  if (!user) {
    sendJson(res, 401, { error: "Sign in to use Invite and Earn." });
    return;
  }

  if (req.method === "GET") {
    try {
      const status = await getInviteStatus(user, env);
      sendJson(res, 200, status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite status unavailable.";
      sendJson(res, 503, { error: message });
    }
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "Invalid request" });
    return;
  }

  const action = typeof body.action === "string" ? body.action : "status";

  try {
    if (action === "status") {
      sendJson(res, 200, await getInviteStatus(user, env));
      return;
    }
    if (action === "attach") {
      const code = typeof body.code === "string" ? body.code : "";
      const result = await attachReferral(user, code, env);
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }
    if (action === "identity") {
      const result = await submitIdentity(
        user,
        {
          legalName: typeof body.legalName === "string" ? body.legalName : "",
          dob: typeof body.dob === "string" ? body.dob : "",
          country: typeof body.country === "string" ? body.country : "",
          idType: typeof body.idType === "string" ? body.idType : "",
          idLast4: typeof body.idLast4 === "string" ? body.idLast4 : "",
          attestation: body.attestation === true,
        },
        env,
      );
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }
    if (action === "card-link") {
      const checkout = await createCardVerifyCheckout(user.id, user.email, req.headers, env);
      sendJson(res, checkout.statusCode, checkout.body);
      return;
    }
    if (action === "card-confirm") {
      const result = await confirmRecentCardPayment(user.id, env);
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }
    sendJson(res, 400, { error: "Unknown action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite service unavailable.";
    sendJson(res, 503, { error: message });
  }
}

export function configureInviteApi(server: ViteDevServer, env: InviteEnv) {
  server.middlewares.use("/api/invite", async (req, res, next) => {
    const method = (req as IncomingMessage).method;
    if (method !== "GET" && method !== "POST") {
      next();
      return;
    }
    await handleInvite(req as IncomingMessage, res as ServerResponse, env);
  });
}

type ServerlessRequest = IncomingMessage & { body?: unknown };
type ServerlessResponse = ServerResponse & {
  status(statusCode: number): ServerlessResponse;
  json(body: unknown): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  await handleInvite(req, res, process.env);
}
