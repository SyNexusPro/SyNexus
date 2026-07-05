import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackSiteEvent } from "../lib/siteAnalytics";

/** Tracks route changes as page views (throttled per path). */
export function SiteAnalyticsListener() {
  const location = useLocation();
  const firstPaint = useRef(true);

  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
    }
    trackSiteEvent("page_view", {
      path: `${location.pathname}${location.search}${location.hash}`,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
}
