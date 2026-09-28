import type { AuthChangeEvent } from "@supabase/supabase-js";

/** Fires often in the background; must not reload dashboards or re-run MFA. */
export function isBackgroundAuthRefresh(event: AuthChangeEvent): boolean {
  return event === "TOKEN_REFRESHED";
}

/** Events that should reload operator profile, watchlists, and market hydration. */
export function shouldReloadOperatorSession(event: AuthChangeEvent): boolean {
  return (
    event === "INITIAL_SESSION" ||
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "USER_UPDATED" ||
    event === "PASSWORD_RECOVERY"
  );
}
