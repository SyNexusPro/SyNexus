/**
 * RevenueCat is archived. Code and webhook routes remain for historical App Store /
 * Play entitlements and rollback, but SyNexus web billing is Paddle-only.
 *
 * Set REVENUECAT_ARCHIVED=false only if you deliberately re-enable RC lookups.
 */
export function isRevenueCatArchived(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env.REVENUECAT_ARCHIVED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}
