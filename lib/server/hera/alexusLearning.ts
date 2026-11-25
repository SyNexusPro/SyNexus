/**
 * Read the newest stored Alexus report and turn it into a short brief for Hera.
 * Paper results only. This never places an order or clears a pause.
 */
import postgres from "postgres";
import { supabaseAdminFromEnv } from "../titan/authPlan.js";

type Env = Record<string, string | undefined>;

const CACHE_MS = 60_000;
let cache: { at: number; brief: string } | null = null;

export function resetAlexusLearningCache(): void {
  cache = null;
}

function connectDb(env: Env): postgres.Sql | null {
  const url = (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

function hasLessonLines(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const lessons = (snapshot as { alexusLessons?: { lines?: unknown } }).alexusLessons;
  return Array.isArray(lessons?.lines) && lessons.lines.some((line) => typeof line === "string" && line.trim());
}

async function loadNewestReportViaDb(
  env: Env,
): Promise<{ received_at?: string; snapshot?: unknown } | null> {
  const sql = connectDb(env);
  if (!sql) return null;
  try {
    // Prefer the newest report that carries measured lessons; fall back to newest overall.
    const withLessons = await sql<{ received_at: string; snapshot: unknown }[]>`
      select received_at, snapshot
      from public.alexus_reports
      where jsonb_typeof(snapshot->'alexusLessons'->'lines') = 'array'
        and jsonb_array_length(snapshot->'alexusLessons'->'lines') > 0
      order by received_at desc
      limit 1
    `;
    if (withLessons[0]) return withLessons[0];
    const rows = await sql<{ received_at: string; snapshot: unknown }[]>`
      select received_at, snapshot
      from public.alexus_reports
      order by received_at desc
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function formatAlexusLearning(snapshot: unknown, receivedAt?: string | null): string {
  const snap = snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : {};
  const lessons = snap.alexusLessons && typeof snap.alexusLessons === "object"
    ? (snap.alexusLessons as Record<string, unknown>)
    : null;
  const world = snap.worldLearn && typeof snap.worldLearn === "object"
    ? (snap.worldLearn as { items?: { source?: string; title?: string; extra?: string }[]; sourcesOk?: string[] })
    : null;
  const expectancy = snap.learnedExpectancy && typeof snap.learnedExpectancy === "object"
    ? (snap.learnedExpectancy as { updatedAt?: string; totalPriced?: number })
    : null;
  const heartbeat = snap.heartbeat && typeof snap.heartbeat === "object"
    ? (snap.heartbeat as {
        status?: string;
        paused?: boolean;
        armed?: boolean;
        readOnly?: boolean;
        oneOrder?: string;
        at?: string;
        cycle?: number;
      })
    : null;
  const lines: string[] = [
    `ALEXUS WATCH${receivedAt ? ` received ${receivedAt}` : ""}.`,
    "Hera guides and watches over Alexus. These are paper simulations of Alexus's decisions, not live fills. Hera cannot trade, unpause, arm, or sign a wallet for her. A LOW band is not a safety clearance.",
  ];
  if (heartbeat) {
    const status = text(heartbeat.status, 40) || "unknown";
    const paused =
      heartbeat.paused === true ? "paused" : heartbeat.paused === false ? "not paused" : "pause unknown";
    const armed = heartbeat.armed === true ? "armed" : heartbeat.armed === false ? "disarmed" : "arm unknown";
    const mode = heartbeat.readOnly === true ? "read-only" : "live-capable";
    const oneOrder = text(heartbeat.oneOrder, 60);
    lines.push(
      `- Watch status: ${status}; ${paused}; ${armed}; ${mode}` +
        `${oneOrder ? `; one-order ${oneOrder}` : ""}` +
        `${typeof heartbeat.cycle === "number" ? `; cycle ${heartbeat.cycle}` : ""}` +
        `${heartbeat.at ? ` (heartbeat ${text(heartbeat.at, 40)})` : ""}.`,
    );
  }
  const lessonLines = Array.isArray(lessons?.lines) ? lessons.lines.filter((l): l is string => typeof l === "string").slice(0, 8) : [];
  if (lessonLines.length) lines.push(...lessonLines.map((l) => `- ${l}`));
  else lines.push("- No measured Alexus lesson was stored in this report. Do not invent win rates or results.");
  if (typeof expectancy?.totalPriced === "number") {
    lines.push(`- Expectancy learner has priced ${expectancy.totalPriced} paper results${expectancy.updatedAt ? ` as of ${expectancy.updatedAt}` : ""}.`);
  }
  const items = (world?.items ?? []).slice(0, 8);
  if (items.length) {
    lines.push("Last public context Alexus stored (may be older than the live venue desk):");
    for (const item of items) {
      const title = text(item.title, 120);
      if (!title || /unavailable/i.test(title)) continue;
      lines.push(`- ${text(item.source, 40) || "source"}: ${title}${item.extra ? ` (${text(item.extra, 80)})` : ""}`);
    }
  }
  return lines.join("\n").slice(0, 2500);
}

export async function loadAlexusLearningBrief(env: Env): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.brief;
  const unavailable =
    "ALEXUS LEARNING unavailable. No stored report was read. Do not invent Alexus results, win rates, or prices.";

  let row: { received_at?: string; snapshot?: unknown } | null = null;
  let tableMissing = false;

  const admin = supabaseAdminFromEnv(env);
  if (admin) {
    const { data, error } = await admin
      .from("alexus_reports")
      .select("received_at,snapshot")
      .order("received_at", { ascending: false })
      .limit(8);
    if (!error && Array.isArray(data) && data.length) {
      const typed = data as { received_at?: string; snapshot?: unknown }[];
      row = typed.find((item) => hasLessonLines(item.snapshot)) ?? typed[0] ?? null;
    } else if (error && /PGRST205|42P01|does not exist/i.test(error.message)) {
      tableMissing = true;
    }
  }

  // Fallback when the service-role key is missing/invalid but SUPABASE_DB_URL works.
  if (!row || !hasLessonLines(row.snapshot)) {
    const viaDb = await loadNewestReportViaDb(env);
    if (viaDb && (!row || hasLessonLines(viaDb.snapshot))) row = viaDb;
  }

  if (!row) {
    const brief = tableMissing
      ? "ALEXUS LEARNING not stored yet. The report table is not ready, so Hera has not read a new Alexus report. Do not invent results."
      : unavailable;
    cache = { at: Date.now(), brief };
    return brief;
  }

  const brief = formatAlexusLearning(row.snapshot, row.received_at ?? null);
  cache = { at: Date.now(), brief };
  return brief;
}
