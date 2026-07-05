import { hasSupabaseEnv, supabase } from "./supabaseClient";

export type SiteAnalyticsEvent =
  | "page_view"
  | "sign_in"
  | "sign_up"
  | "sign_out"
  | "magic_link_sent"
  | "password_reset_requested"
  | "verification_email_resent"
  | "biometric_sign_in"
  | "token_view";

export type SiteAnalyticsDetail = {
  path?: string;
  userId?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

const VISITOR_KEY = "synexus_visitor_id";
const PAGE_VIEW_THROTTLE_MS = 30_000;
const lastPageViewAt = new Map<string, number>();

export function getVisitorId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export function trackSiteEvent(eventType: SiteAnalyticsEvent, detail: SiteAnalyticsDetail = {}) {
  if (!hasSupabaseEnv || !supabase) return;

  const path =
    detail.path ??
    (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/");

  if (eventType === "page_view") {
    const throttleKey = `${getVisitorId()}:${path}`;
    const now = Date.now();
    const last = lastPageViewAt.get(throttleKey) ?? 0;
    if (now - last < PAGE_VIEW_THROTTLE_MS) return;
    lastPageViewAt.set(throttleKey, now);
  }

  void supabase
    .from("site_analytics_events")
    .insert({
      event_type: eventType,
      path: path.slice(0, 512),
      visitor_id: getVisitorId().slice(0, 64),
      user_id: detail.userId ?? null,
      meta: detail.meta ?? {},
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        console.debug("[analytics]", eventType, error.message);
      }
    });
}

export type SiteAnalyticsSummary = {
  rangeDays: number;
  updatedAt: string;
  totals: {
    pageViews: number;
    uniqueVisitors: number;
    signIns: number;
    signUps: number;
    signOuts: number;
    magicLinks: number;
    tokenViews: number;
    biometricSignIns: number;
  };
  daily: Array<{
    date: string;
    pageViews: number;
    uniqueVisitors: number;
    signIns: number;
    signUps: number;
    signOuts: number;
  }>;
  topPages: Array<{ path: string; views: number; uniqueVisitors: number }>;
  recentEvents: Array<{
    eventType: string;
    path: string;
    createdAt: string;
    visitorId: string;
  }>;
};

export async function fetchSiteAnalyticsSummary(
  grant: string,
  days = 7,
): Promise<SiteAnalyticsSummary> {
  const response = await fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant, days }),
  });
  const data = (await response.json().catch(() => ({}))) as SiteAnalyticsSummary & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not load analytics.");
  }
  return data;
}
