import type { IncomingMessage, ServerResponse } from "node:http";

type ApiHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => unknown | Promise<unknown>;

type RouteModule = { default: ApiHandler };

const loaders: Record<string, () => Promise<RouteModule>> = {
  "/api/analytics": () => import("./_routes/analytics.js"),
  "/api/checkout": () => import("./_routes/checkout.js"),
  "/api/cron/titan-daily": () => import("./_routes/cron/titan-daily.js"),
  "/api/cron/titan-discovery": () => import("./_routes/cron/titan-discovery.js"),
  "/api/cron/titan-launch-watch": () => import("./_routes/cron/titan-launch-watch.js"),
  "/api/hera/launch-watch": () => import("./_routes/hera/launch-watch.js"),
  "/api/hera/live-token": () => import("./_routes/hera/live-token.js"),
  "/api/hera/realtime-session": () => import("./_routes/hera/realtime-session.js"),
  "/api/hera/session": () => import("./_routes/hera/session.js"),
  "/api/hera/stt": () => import("./_routes/hera/stt.js"),
  "/api/hera/tts": () => import("./_routes/hera/tts.js"),
  "/api/hera/voice-stream": () => import("./_routes/hera/voice-stream.js"),
  "/api/invite": () => import("./_routes/invite.js"),
  "/api/ownerUnlock": () => import("./_routes/ownerUnlock.js"),
  "/api/push/subscribe": () => import("./_routes/push/subscribe.js"),
  "/api/square/webhook": () => import("./_routes/square/webhook.js"),
  "/api/subscription/webhook": () => import("./_routes/subscription/webhook.js"),
  "/api/titan/chat": () => import("./_routes/titan/chat.js"),
  "/api/titan/event": () => import("./_routes/titan/event.js"),
  "/api/titan/warm": () => import("./_routes/titan/warm.js"),
  "/api/webhook": () => import("./_routes/webhook.js"),
  "/api/whale/events": () => import("./_routes/whale/events.js"),
  "/api/whale/poll": () => import("./_routes/whale/poll.js"),
  "/api/whale/webhook": () => import("./_routes/whale/webhook.js"),
};

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function resolveRoute(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  const fromQuery = url.searchParams.get("__route");
  if (fromQuery) return normalizePath(fromQuery);

  const invoke = req.headers["x-invoke-path"];
  if (typeof invoke === "string" && invoke.startsWith("/api")) {
    return normalizePath(invoke.split("?")[0] ?? invoke);
  }

  const matched = req.headers["x-matched-path"];
  if (typeof matched === "string" && matched.startsWith("/api") && matched !== "/api/gateway") {
    return normalizePath(matched.split("?")[0] ?? matched);
  }

  return normalizePath(url.pathname);
}

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const route = resolveRoute(req);
  const load = loaders[route];
  if (!load) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const mod = await load();
  await mod.default(req, res);
}
