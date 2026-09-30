import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveCommunityAccess } from "../../../lib/server/community/access.js";
import {
  useApiRoute,
  type ConnectHandler,
  type ViteDevServer,
} from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

async function respond(
  req: IncomingMessage,
  res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">,
  env: Env,
) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const access = await resolveCommunityAccess(req, env);
  res.statusCode = access.authorized
    ? 200
    : access.reason === "authentication_required"
      ? 401
      : access.reason === "membership_required"
        ? 403
        : access.reason === "account_restricted"
          ? 423
          : 404;
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(access));
}

export function configureCommunityAccessApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await respond(req as IncomingMessage, res as ServerResponse, env);
  };
  useApiRoute(server, "/api/community/access", middleware);
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  await respond(req, res, process.env);
}
