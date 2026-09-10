/** One-time copy of pre-rebrand localStorage keys → SyNexus keys. */
const KEY_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ["hivemind_paid_plan", "synexus_paid_plan"],
  ["hivemind_demo_session", "synexus_demo_session"],
  ["hivemind_pending_reports", "synexus_pending_reports"],
  ["hivemind_bug_reports", "synexus_bug_reports"],
  ["hivemind_pending_verification_email", "synexus_pending_verification_email"],
  ["hivemind_pro_banner_dismissed", "synexus_pro_banner_dismissed"],
  ["hivemind_syneux_marketing_checklist_v1", "synexus_marketing_checklist_v1"],
  ["hivemind-affiliate-handle", "synexus-affiliate-handle"],
  ["hivemind-supabase-auth", "synexus-supabase-auth"],
];

export function migrateLegacyStorageKeys(): void {
  if (typeof localStorage === "undefined") return;
  for (const [from, to] of KEY_MIGRATIONS) {
    try {
      if (localStorage.getItem(to) != null) {
        localStorage.removeItem(from);
        continue;
      }
      const value = localStorage.getItem(from);
      if (value != null) {
        localStorage.setItem(to, value);
        localStorage.removeItem(from);
      }
    } catch {
      /* ignore quota / private mode */
    }
  }
}
