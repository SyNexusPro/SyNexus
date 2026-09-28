import { isGooglePlayReviewEmail } from "../config/googlePlayReview";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { recordTrustedPlanGrant } from "./securityBot";
import { supabase } from "./supabaseClient";
import { PLAN_STORAGE_KEY } from "./tradingFees";
import { updatePaidPlan } from "./supabaseData";

const PLAY_REVIEW_SESSION_KEY = "synexus_play_review_applied";

/**
 * Grant full SyNexus Pro for the dedicated Google Play reviewer login.
 * Profile PRO is set by `scripts/provision-play-reviewer.mjs`; this keeps the client in sync.
 */
export async function applyGooglePlayReviewAccess(
  userId: string | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  if (!userId || !isGooglePlayReviewEmail(email)) return false;

  try {
    if (
      localStorage.getItem(PLAN_STORAGE_KEY) === "PRO" &&
      sessionStorage.getItem(PLAY_REVIEW_SESSION_KEY) === userId
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }

  const planWasPro = localStorage.getItem(PLAN_STORAGE_KEY) === "PRO";
  recordTrustedPlanGrant("PRO", "play_review");
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, "PRO");
  } catch {
    /* ignore */
  }
  if (!planWasPro) {
    notifySynexusPlanChanged();
  }

  try {
    sessionStorage.setItem(PLAY_REVIEW_SESSION_KEY, userId);
  } catch {
    /* ignore */
  }

  try {
    await updatePaidPlan(userId, "PRO");
  } catch {
    /* RLS may block client writes — service-role provision is source of truth */
  }

  return true;
}

/** Re-apply Play reviewer Pro if a reviewer session is already on this device. */
export async function restoreAlwaysOnPlayReviewSession(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return false;
    return applyGooglePlayReviewAccess(user.id, user.email);
  } catch {
    return false;
  }
}
