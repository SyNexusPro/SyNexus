/**
 * One upstream Helius WebSocket for the dev server, fanned out to browser clients.
 * HELIUS_API_KEY never goes to the frontend. Production browsers fall back to
 * one shared /api/dashboard refresh plus Supabase Broadcast.
 */
import type { Server } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { loadDashboardTokens, type DashboardToken } from "../dashboard";

declare module "ws" {
  export default class WebSocket {
    static OPEN: number;
    readyState: number;
    constructor(url: string);
    send(data: string): void;
    close(): void;
    on(event: string, listener: (...args: never[]) => void): void;
  }
  export class WebSocketServer {
    clients: Set<WebSocket>;
    constructor(opts: { noServer: boolean });
    handleUpgrade(
      req: unknown,
      socket: unknown,
      head: unknown,
      cb: (socket: WebSocket) => void,
    ): void;
    on(event: "connection", listener: (socket: WebSocket) => void): void;
  }
}

type Upstream = {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  on: (event: string, listener: (...args: never[]) => void) => void;
};

let upstream: Upstream | null = null;
let clients: { send: (data: string) => void }[] = [];
let lastTokens: DashboardToken[] = [];
let pumpTimer: ReturnType<typeof setInterval> | null = null;

function broadcast(payload: unknown): void {
  const raw = JSON.stringify(payload);
  for (const client of clients) {
    try {
      client.send(raw);
    } catch {
      /* closed */
    }
  }
}

function diffTokens(next: DashboardToken[]): DashboardToken[] {
  const prev = new Map(lastTokens.map((token) => [token.mint, token]));
  return next.filter((token) => {
    const old = prev.get(token.mint);
    if (!old) return true;
    return (
      old.priceUsd !== token.priceUsd ||
      old.change24hPct !== token.change24hPct ||
      old.marketCapUsd !== token.marketCapUsd ||
      old.safetyScore !== token.safetyScore
    );
  });
}

async function pump(): Promise<void> {
  try {
    const tokens = await loadDashboardTokens();
    if (!lastTokens.length) {
      lastTokens = tokens;
      broadcast({
        type: "snapshot",
        dashboard: { tokens, updatedAt: Date.now() },
      });
      return;
    }
    const changed = diffTokens(tokens);
    lastTokens = tokens;
    if (changed.length) {
      broadcast({ type: "patch", tokens: changed, updatedAt: Date.now() });
    }
  } catch {
    /* keep the last tape */
  }
}

function heliusUrl(env: Record<string, string | undefined>): string | null {
  const explicit = env.HELIUS_WS_URL?.trim();
  if (explicit) return explicit;
  const key = env.HELIUS_API_KEY?.trim();
  if (!key) return null;
  return `wss://mainnet.helius-rpc.com/?api-key=${key}`;
}

async function openHelius(url: string): Promise<void> {
  const mod = await import("ws");
  const WS = mod.default;
  if (upstream) return;
  const socket = new WS(url);
  upstream = socket;
  socket.on("open", () => {
    socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "logsSubscribe",
        params: [{ mentions: ["So11111111111111111111111111111111111111112"] }, { commitment: "confirmed" }],
      }),
    );
  });
  let lastActivity = 0;
  socket.on("message", () => {
    const now = Date.now();
    if (now - lastActivity < 2000) return;
    lastActivity = now;
    broadcast({
      type: "event",
      name: "TOKEN_ACTIVITY",
      detail: "Solana activity",
    });
  });
  socket.on("close", () => {
    upstream = null;
    setTimeout(() => {
      void openHelius(url);
    }, 2000);
  });
  socket.on("error", () => {
    socket.close();
  });
}

export function configureRealtimeBridge(
  server: ViteDevServer,
  env: Record<string, string | undefined>,
): void {
  const httpServer = (server as ViteDevServer & { httpServer?: Server | null }).httpServer;
  if (!httpServer || pumpTimer) return;

  void import("ws").then((mod) => {
    const wss = new mod.WebSocketServer({ noServer: true });
    httpServer.on("upgrade", (req, socket, head) => {
      const path = req.url?.split("?")[0] ?? "";
      if (path !== "/api/realtime/ws") return;
      wss.handleUpgrade(req, socket, head, (client) => {
        clients.push(client);
        if (lastTokens.length) {
          client.send(
            JSON.stringify({
              type: "snapshot",
              dashboard: { tokens: lastTokens, updatedAt: Date.now() },
            }),
          );
        }
        client.on("close", () => {
          clients = clients.filter((row) => row !== client);
        });
      });
    });
  });

  void pump();
  pumpTimer = setInterval(() => {
    void pump();
  }, 15_000);

  const url = heliusUrl(env);
  if (url) void openHelius(url);
}
