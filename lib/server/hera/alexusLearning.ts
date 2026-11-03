/**
 * Read the newest stored Alexus report and turn it into a short brief for Hera.
 * Paper results only. This never places an order or clears a pause.
 */
import { supabaseAdminFromEnv } from "../titan/authPlan.js";

type Env = Record<string, string | undefined>;

const CACHE_MS = 60_000;
let cache: { at: number; brief: string } | null = null;

export function resetAlexusLearningCache(): void {
  cache = null;
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
  const lines: string[] = [
    `ALEXUS LEARNING${receivedAt ? ` received ${receivedAt}` : ""}.`,
    "These are paper simulations of Alexus's own decisions, not live fills. Hera cannot trade, unpause the bot, or sign a wallet from this. A LOW band is not a safety clearance.",
  ];
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
  const unavailable = "ALEXUS LEARNING unavailable. No stored report was read. Do not invent Alexus results, win rates, or prices.";
  const admin = supabaseAdminFromEnv(env);
  if (!admin) {
    cache = { at: Date.now(), brief: unavailable };
    return unavailable;
  }
  const { data, error } = await admin
    .from("alexus_reports")
    .select("received_at,snapshot")
    .order("received_at", { ascending: false })
    .limit(1);
  if (error || !Array.isArray(data) || !data[0]) {
    const missing = error && /PGRST205|42P01|does not exist/i.test(error.message);
    const brief = missing
      ? "ALEXUS LEARNING not stored yet. The report table is not ready, so Hera has not read a new Alexus report. Do not invent results."
      : unavailable;
    cache = { at: Date.now(), brief };
    return brief;
  }
  const row = data[0] as { received_at?: string; snapshot?: unknown };
  const brief = formatAlexusLearning(row.snapshot, row.received_at ?? null);
  cache = { at: Date.now(), brief };
  return brief;
}
