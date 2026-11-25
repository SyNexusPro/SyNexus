/**
 * RevenueCat client SDKs are archived. Files remain under src/lib/revenuecat*.ts
 * for native rollback, but web checkout must not call them.
 *
 * Override only for emergency: VITE_REVENUECAT_ARCHIVED=false
 */
export function isRevenueCatArchived(): boolean {
  const raw = String(import.meta.env.VITE_REVENUECAT_ARCHIVED ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}
