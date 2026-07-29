import { GA_MEASUREMENT_ID } from "../config/analytics";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function isGoogleAnalyticsConfigured(): boolean {
  return GA_MEASUREMENT_ID.length > 0 && GA_MEASUREMENT_ID.startsWith("G-");
}

/** Load gtag.js once (Google's recommended GA4 snippet). */
export function initGoogleAnalytics(): void {
  if (initialized || typeof window === "undefined" || !isGoogleAnalyticsConfigured()) return;

  initialized = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    ...(import.meta.env.DEV ? { debug_mode: true } : {}),
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

/** SPA route change — sends a GA4 page_view (required for React Router). */
export function trackGoogleAnalyticsPageView(pagePath: string): void {
  if (!initialized || !window.gtag || !isGoogleAnalyticsConfigured()) return;

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_title: document.title,
  });
}
