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

/** Supabase returns this when the Google provider toggle is off. */
export async function assertGoogleProviderEnabled(): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return;
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
  });
  if (!response.ok) return;
  const settings = (await response.json()) as { external?: { google?: boolean } };
  if (settings.external?.google === false) {
    throw new Error(
      "Google sign-in is turned off in Supabase. Enable the Google provider, then try again.",
    );
  }
}
