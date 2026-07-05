import { createClient } from "@supabase/supabase-js";

/**
 * Values come from import.meta.env — filled at **build time** on Vercel from `VITE_SUPABASE_*`
 * (or fallbacks `SUPABASE_*` / `SUPABASE_ANON_KEY` wired in vite.config.ts).
 *
 * For auth in production, add your site URL under Supabase → Authentication → URL configuration
 * (e.g. `https://your-project.vercel.app`).
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
        storageKey: "hivemind-supabase-auth",
      },
    })
  : null;

export function authRedirectUrl(path = "/pulse"): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}
