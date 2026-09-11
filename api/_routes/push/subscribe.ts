import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";
import { resolveTitanAuthPlan, supabaseAdminFromEnv } from "../../../lib/server/titan/authPlan.js";

type Env = Record<string, string | undefined>;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function handlePushSubscribe(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<void> {
  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        vapidPublicKey: env.VAPID_PUBLIC_KEY?.trim() || null,
      }),
    );
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const auth = await resolveTitanAuthPlan(req, env);
  if (!auth.authenticated || !auth.userId) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "auth_required" }));
    return;
  }
  if (auth.plan !== "PRO") {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "pro_required" }));
    return;
  }

  const admin = supabaseAdminFromEnv(env);
  if (!admin) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "unavailable" }));
    return;
  }

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    platform?: string;
    minUsd?: number;
  };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "invalid_json" }));
    return;
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const authKey = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !authKey) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "missing_subscription" }));
    return;
  }

  const platform = body.platform === "android" || body.platform === "ios" ? body.platform : "web";

  await admin.from("push_subscriptions").upsert(
    {
      user_id: auth.userId,
      endpoint,
      p256dh,
      auth: authKey,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  const minUsd = Number(body.minUsd);
  await admin.from("whale_alert_prefs").upsert({
    user_id: auth.userId,
    enabled: true,
    min_usd: Number.isFinite(minUsd) && minUsd > 0 ? minUsd : 10_000,
    updated_at: new Date().toISOString(),
  });

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true }));
}

export function configurePushSubscribeApi(server: ViteDevServer, env: Env) {
  server.middlewares.use("/api/push/subscribe", async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "POST") {
      next();
      return;
    }
    await handlePushSubscribe(req, res, env);
  });
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ServerlessResponse = {
  setHeader(name: string, value: string): void;
  end(body?: string): void;
  statusCode?: number;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  await handlePushSubscribe(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    process.env,
  );
}
