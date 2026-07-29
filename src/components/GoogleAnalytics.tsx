import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { initGoogleAnalytics, trackGoogleAnalyticsPageView } from "../lib/googleAnalytics";

/** Global GA4 — initial load + every React Router navigation. */
export function GoogleAnalytics() {
  const location = useLocation();
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    initGoogleAnalytics();
  }, []);

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    trackGoogleAnalyticsPageView(pagePath);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
