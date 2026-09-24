import type { DashboardSnapshot } from "./types";

const KEY = "synexus.realtime.dashboard.v1";

export function readDashboardCache(): DashboardSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSnapshot;
    if (!parsed || !Array.isArray(parsed.tokens)) return null;
    return { ...parsed, source: "cache", connected: false };
  } catch {
    return null;
  }
}

export function writeDashboardCache(snapshot: DashboardSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* quota or private mode */
  }
}
