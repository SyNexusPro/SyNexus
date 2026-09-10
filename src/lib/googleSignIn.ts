import { Capacitor } from "@capacitor/core";
import { hasSupabaseEnv } from "./supabaseClient";

/** Web only — native OAuth needs App Links before the session can return to the app. */
export function googleSignInAvailable(): boolean {
  return hasSupabaseEnv && !Capacitor.isNativePlatform();
}
