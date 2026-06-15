import { supabase, hasSupabaseEnv } from "../supabaseClient";
import type { SecurityEvent } from "./types";

/** Fire-and-forget server audit for serious blocks (requires security_events table). */
export function syncRemoteSecurityEvent(event: SecurityEvent, fingerprint: string) {
  if (!hasSupabaseEnv || !supabase) return;
  if (!event.blocked) return;
  if (event.severity !== "high" && event.severity !== "critical") return;

  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;
      await supabase.from("security_events").insert({
        user_id: userId,
        event_type: event.code,
        severity: event.severity,
        action: event.action,
        message: event.message.slice(0, 500),
        detail: event.detail ?? {},
        client_fingerprint: fingerprint.slice(0, 64),
        blocked: true,
      });
    } catch {
      /* table may not exist yet — local log is enough */
    }
  })();
}
