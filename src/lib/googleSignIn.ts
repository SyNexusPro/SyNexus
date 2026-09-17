import { Capacitor } from "@capacitor/core";
import { hasSupabaseEnv } from "./supabaseClient";

/**
 * Google OAuth via Supabase. Shown on web and in the Android WebView when the
 * shell loads https:// (production). Hidden only for local capacitor:// origins.
 */
export function googleSignInAvailable(): boolean {
  if (!hasSupabaseEnv) return false;
  if (!Capacitor.isNativePlatform()) return true;
  if (typeof window === "undefined") return false;
  const origin = window.location.origin;
  return origin.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(origin);
}
