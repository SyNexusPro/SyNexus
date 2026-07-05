import { createClient } from "@supabase/supabase-js";
import type { ViteDevServer } from "vite";
import { verifyOwnerGrant } from "./_ownerGrant";

type AnalyticsPayload = {
  grant?: string;
  days?: number;
};

type EventRow = {
  event_type: string;
  path: string;
  visitor_id: string;
  created_at: string;
};

function clampDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 7;
  return Math.min(90, Math.max(1, Math.floor(n)));
}

function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

async function buildAnalyticsSummary(days: number) {
  const admin = supabaseAdmin();
  if (!admin) {
    throw new Error("Analytics requires SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();

  const { data, error } = await admin
    .from("site_analytics_events")
    .select("event_type, path, visitor_id, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (error) {
    if (error.message.toLowerCase().includes("does not exist")) {
      throw new Error("Run supabase/site_analytics.sql in your Supabase SQL editor first.");
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as EventRow[];
  const visitorSet = new Set<string>();
  const pageVisitorByPath = new Map<string, Set<string>>();
  const pageViewsByPath = new Map<string, number>();
  const daily = new Map<
    string,
    { pageViews: number; visitors: Set<string>; signIns: number; signUps: number; signOuts: number }
  >();

  const totals = {
    pageViews: 0,
    uniqueVisitors: 0,
    signIns: 0,
    signUps: 0,
    signOuts: 0,
    magicLinks: 0,
    tokenViews: 0,
    biometricSignIns: 0,
  };

  for (const row of rows) {
    visitorSet.add(row.visitor_id);
    const day = isoDay(row.created_at);
    if (!daily.has(day)) {
      daily.set(day, { pageViews: 0, visitors: new Set(), signIns: 0, signUps: 0, signOuts: 0 });
    }
    const bucket = daily.get(day)!;
    bucket.visitors.add(row.visitor_id);

    switch (row.event_type) {
      case "page_view":
        totals.pageViews += 1;
        bucket.pageViews += 1;
        bucket.visitors.add(row.visitor_id);
        pageViewsByPath.set(row.path, (pageViewsByPath.get(row.path) ?? 0) + 1);
        if (!pageVisitorByPath.has(row.path)) pageVisitorByPath.set(row.path, new Set());
        pageVisitorByPath.get(row.path)!.add(row.visitor_id);
        break;
      case "sign_in":
        totals.signIns += 1;
        bucket.signIns += 1;
        break;
      case "sign_up":
        totals.signUps += 1;
        bucket.signUps += 1;
        break;
      case "sign_out":
        totals.signOuts += 1;
        bucket.signOuts += 1;
        break;
      case "magic_link_sent":
        totals.magicLinks += 1;
        break;
      case "token_view":
        totals.tokenViews += 1;
        break;
      case "biometric_sign_in":
        totals.biometricSignIns += 1;
        bucket.signIns += 1;
        break;
      default:
        break;
    }
  }

  totals.uniqueVisitors = visitorSet.size;

  const topPages = [...pageViewsByPath.entries()]
    .map(([path, views]) => ({
      path,
      views,
      uniqueVisitors: pageVisitorByPath.get(path)?.size ?? 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  const dailySeries = [...daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      pageViews: bucket.pageViews,
      uniqueVisitors: bucket.visitors.size,
      signIns: bucket.signIns,
      signUps: bucket.signUps,
      signOuts: bucket.signOuts,
    }));

  const recentEvents = rows.slice(0, 40).map((row) => ({
    eventType: row.event_type,
    path: row.path,
    createdAt: row.created_at,
    visitorId: `${row.visitor_id.slice(0, 8)}…`,
  }));

  return {
    rangeDays: days,
    updatedAt: new Date().toISOString(),
    totals,
    daily: dailySeries,
    topPages,
    recentEvents,
  };
}

async function handleAnalyticsRequest(payload: AnalyticsPayload) {
  if (!verifyOwnerGrant(payload.grant, process.env)) {
    return { statusCode: 401, body: { error: "Owner command code required." } };
  }

  try {
    const summary = await buildAnalyticsSummary(clampDays(payload.days));
    return { statusCode: 200, body: summary };
  } catch (err) {
    return {
      statusCode: 503,
      body: { error: err instanceof Error ? err.message : "Analytics unavailable." },
    };
  }
}

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function configureAnalyticsApi(server: ViteDevServer) {
  server.middlewares.use("/api/analytics", async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    try {
      const payload = JSON.parse(await readRequestBody(req)) as AnalyticsPayload;
      const result = await handleAnalyticsRequest(payload);
      res.statusCode = result.statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.body));
    } catch {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Analytics request failed." }));
    }
  });
}

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  body?: unknown;
};

type ServerlessResponse = {
  status(statusCode: number): ServerlessResponse;
  json(body: unknown): void;
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const payload =
    typeof req.body === "string"
      ? (JSON.parse(req.body) as AnalyticsPayload)
      : ((req.body as AnalyticsPayload | undefined) ?? {});

  const result = await handleAnalyticsRequest(payload);
  res.status(result.statusCode).json(result.body);
}
