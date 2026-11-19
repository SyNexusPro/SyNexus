import type { IncomingMessage, ServerResponse } from "node:http";
import { ownerFromAccessToken } from "../../../lib/server/ownerSession.js";
import {
  discoverNewTokens,
  isSolanaAddress,
  probeHelius,
  recentSignatures,
  redactHelius,
  trackWallet,
} from "../../../lib/server/helius/client.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;

function bearerFrom(authorization: string | string[] | undefined): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() || null;
}

function queryFrom(url: string | undefined): { view: string; address: string } {
  const parsed = new URL(url ?? "/", "http://localhost");
  return {
    view: parsed.searchParams.get("view")?.trim() || "status",
    address: parsed.searchParams.get("address")?.trim() || "",
  };
}

export async function handleOwnerHelius(
  authorization: string | string[] | undefined,
  url: string | undefined,
  env: Env,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const token = bearerFrom(authorization);
  if (!token) return { statusCode: 401, body: { error: "Sign in with the owner account." } };
  const owner = await ownerFromAccessToken(token, env);
  if (!owner.ok) return { statusCode: owner.status, body: { error: owner.error } };

  const { view, address } = queryFrom(url);
  try {
    if (view === "status") {
      const probe = await probeHelius(env);
      return {
        statusCode: 200,
        body: {
          ok: probe.ok,
          configured: probe.configured,
          slot: probe.slot,
          reason: probe.reason,
          features: ["rpc", "transactions", "wallets", "new_tokens", "market_intel"],
        },
      };
    }
    if (view === "transactions" || view === "wallet") {
      if (!isSolanaAddress(address)) return { statusCode: 400, body: { error: "A Solana address is required." } };
      if (view === "transactions") {
        const signatures = await recentSignatures(env, address);
        return { statusCode: 200, body: { ok: true, signatures } };
      }
      const wallet = await trackWallet(env, address);
      return { statusCode: 200, body: { ok: wallet.ok, lamports: wallet.lamports, tokens: wallet.tokens } };
    }
    if (view === "tokens") {
      const tokens = await discoverNewTokens(env, 8);
      return { statusCode: 200, body: { ok: true, tokens } };
    }
    return { statusCode: 400, body: { error: "Unknown view." } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "helius_unreachable";
    return { statusCode: 503, body: { error: redactHelius(message, env) } };
  }
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

export function configureOwnerHeliusApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    const result = await handleOwnerHelius(req.headers.authorization, req.url, env);
    send(res, result);
  };
  useApiRoute(server, "/api/owner/helius", middleware);
}

type ServerlessRequest = {
  method?: string;
  url?: string;
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
  if (req.method !== "GET") {
    if (typeof res.status === "function") {
      res.status(405).json?.({ error: "Method not allowed" });
      return;
    }
    res.statusCode = 405;
    res.setHeader?.("Content-Type", "application/json");
    res.end?.(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  const result = await handleOwnerHelius(req.headers?.authorization, req.url, process.env);
  if (typeof res.status === "function") {
    res.status(result.statusCode).json?.(result.body);
    return;
  }
  res.statusCode = result.statusCode;
  res.setHeader?.("Content-Type", "application/json");
  res.setHeader?.("Cache-Control", "no-store");
  res.end?.(JSON.stringify(result.body));
}
