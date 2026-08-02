import { useEffect } from "react";
import { markNativePerformanceMode } from "../lib/nativePerformance";

/** One-time native shell tuning (CSS classes, lifecycle hooks elsewhere). */
export function NativePerformanceInit() {
  useEffect(() => {
    markNativePerformanceMode();
  }, []);
  return null;
}
