import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGoogleAnalytics, trackGoogleAnalyticsPageView } from "../lib/googleAnalytics";

/** Global GA4 — initial load + every React Router navigation. */
export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    initGoogleAnalytics();
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    trackGoogleAnalyticsPageView(pagePath);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
