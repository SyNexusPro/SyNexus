import { useLayoutEffect } from "react";
import { markNativePerformanceMode } from "../lib/nativePerformance";

/** One-time native shell tuning (CSS classes + Android input hardening). */
export function NativePerformanceInit() {
  useLayoutEffect(() => {
    markNativePerformanceMode();
  }, []);
  return null;
}
