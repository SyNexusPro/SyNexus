import {
  isSharedTesterEmail,
  isSharedTesterProActive,
  SHARED_TESTER_PRO_UNTIL_ISO,
} from "../config/testerAccess";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { recordTrustedPlanGrant } from "./securityBot";
import { PLAN_STORAGE_KEY } from "./tradingFees";
import { updatePaidPlan } from "./supabaseData";

const TESTER_UNTIL_KEY = "synexus_tester_pro_until";

/**
 * Grant SyNexus Pro for the shared tester login until SHARED_TESTER_PRO_UNTIL_ISO.
 * Returns false if email is not the shared tester or access has expired.
 */
export async function applySharedTesterAccess(
  userId: string | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  if (!userId || !isSharedTesterEmail(email)) return false;

  if (!isSharedTesterProActive()) {
    try {
      localStorage.removeItem(TESTER_UNTIL_KEY);
      const grantRaw = sessionStorage.getItem("synexus_aegis_plan_grant");
      if (grantRaw) {
        const grant = JSON.parse(grantRaw) as { source?: string };
        if (grant.source === "tester_30d") {
          sessionStorage.removeItem("synexus_aegis_plan_grant");
          localStorage.setItem(PLAN_STORAGE_KEY, "FREE");
          notifySynexusPlanChanged();
        }
      }
    } catch {
      /* ignore */
    }
    try {
      await updatePaidPlan(userId, "FREE");
    } catch {
      /* optional */
    }
    return false;
  }

  recordTrustedPlanGrant("PRO", "tester_30d");
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, "PRO");
    localStorage.setItem(TESTER_UNTIL_KEY, SHARED_TESTER_PRO_UNTIL_ISO);
  } catch {
    /* ignore */
  }
  notifySynexusPlanChanged();

  try {
    await updatePaidPlan(userId, "PRO");
  } catch {
    /* RLS may block — provision script is source of truth */
  }

  return true;
}
