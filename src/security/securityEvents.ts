import { supabase } from "../lib/supabaseClient";

export type SecurityEventType =
  | "login_success"
  | "login_failure"
  | "mfa_success"
  | "mfa_failure"
  | "mfa_enrolled"
  | "mfa_removed"
  | "passkey_added"
  | "passkey_removed"
  | "password_changed"
  | "sessions_revoked";

function deviceDescription(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  return "Web";
}

export async function recordSecurityEvent(input: {
  eventType: SecurityEventType;
  success: boolean;
}): Promise<void> {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: input.eventType,
      severity: input.success ? "low" : "medium",
      action: input.eventType,
      message: input.eventType,
      success: input.success,
      device_description: deviceDescription(),
      blocked: !input.success,
    });
  } catch {
    /* never log secrets; ignore audit write failures */
  }
}

export type SecurityEventRow = {
  id: string;
  event_type: string;
  created_at: string;
  device_description: string | null;
  success: boolean | null;
};

export async function listOwnSecurityEvents(limit = 20): Promise<SecurityEventRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("security_events")
    .select("id, event_type, created_at, device_description, success")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as SecurityEventRow[];
}
