import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SITE_URL } from "../config/site";

/**
 * Values come from import.meta.env — filled at **build time** on Vercel from `VITE_SUPABASE_*`
 * (or fallbacks `SUPABASE_*` / `SUPABASE_ANON_KEY` wired in vite.config.ts).
 *
 * For auth in production, add your site URL under Supabase → Authentication → URL configuration
 * (e.g. `https://www.synexus.pro`) and `/pulse`, `/security/setup`, `/security/verify`
 * on Redirect URLs. Enable the Google provider there for “Continue with Google”.
 * Configure Phone Auth with Twilio Verify under Authentication → Providers.
 * TOTP remains optional in Security Settings.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "synexus-supabase-auth",
      },
    })
  : null;

function normalizeAuthPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Same-origin redirects (OAuth PKCE must stay on the tab that started sign-in). */
export function authRedirectUrl(path = "/pulse"): string {
  if (typeof window === "undefined") {
    return `${PUBLIC_SITE_URL.replace(/\/$/, "")}${normalizeAuthPath(path)}`;
  }
  return `${window.location.origin}${normalizeAuthPath(path)}`;
}

/**
 * Links inside Supabase emails (reset, confirm, magic link). Always use the public
 * site URL so messages never point at Vercel preview deployments or SSO gates.
 */
export function emailAuthRedirectUrl(path = "/pulse"): string {
  const normalizedPath = normalizeAuthPath(path);
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return `${origin}${normalizedPath}`;
    }
  }
  return `${PUBLIC_SITE_URL.replace(/\/$/, "")}${normalizedPath}`;
}

/**
 * Keep the OAuth return on the origin that started PKCE. The verifier is stored
 * by that origin, so crossing between synexus.pro, www, or a preview deployment
 * can make an otherwise successful Google login fail during code exchange.
 */
export function googleAuthRedirectUrl(): string {
  return authRedirectUrl("/pulse");
}
