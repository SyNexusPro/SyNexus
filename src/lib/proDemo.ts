import { isSignupTrialGrantSource, SYNEXUS_PRO_TRIAL_MS } from "../config/proTrial";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { hasStoredOwnerGrant } from "./ownerAccess";
import { PLAN_STORAGE_KEY } from "./tradingFees";

/** Active trial end timestamp (ms). */
export const PRO_TRIAL_UNTIL_KEY = "synexus_pro_trial_until";
/** Legacy 5-minute demo key — read for migration only. */
export const PRO_DEMO_UNTIL_KEY = "synexus_pro_demo_until";
export const PRO_TRIAL_STARTED_KEY = "synexus_pro_trial_started";
export const PRO_TRIAL_USER_ID_KEY = "synexus_pro_trial_user_id";
export const PRO_DEMO_CHANGED = "synexus-pro-demo-changed";

export const PRO_DEMO_DURATION_MS = SYNEXUS_PRO_TRIAL_MS;
export const PRO_TRIAL_DURATION_MS = SYNEXUS_PRO_TRIAL_MS;

const PAID_GRANT_SOURCES = new Set([
  "subscription_checkout",
  "paddle_checkout",
  "supabase_profile",
  "owner",
  "admin",
  "play_review",
  "invite_30d",
]);

function readPlanGrantSource(): string | null {
  try {
    const raw = sessionStorage.getItem("synexus_aegis_plan_grant");
    if (!raw) return null;
    const grant = JSON.parse(raw) as { source?: string; plan?: string };
    return grant.plan === "PRO" ? (grant.source ?? null) : null;
  } catch {
    return null;
  }
}

function hasPaidProGrant(): boolean {
  if (hasStoredOwnerGrant()) return true;
  const source = readPlanGrantSource();
  return source !== null && PAID_GRANT_SOURCES.has(source);
}

function readUntil(): number | null {
  try {
    const raw =
      localStorage.getItem(PRO_TRIAL_UNTIL_KEY) ?? localStorage.getItem(PRO_DEMO_UNTIL_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function hasProTrialBeenUsed(userId?: string): boolean {
  try {
    if (localStorage.getItem(PRO_TRIAL_STARTED_KEY) !== "1") return false;
    const trialUserId = localStorage.getItem(PRO_TRIAL_USER_ID_KEY);
    if (!userId) return Boolean(trialUserId);
    return trialUserId === userId;
  } catch {
    return false;
  }
}

export function isProDemoActive(now = Date.now()): boolean {
  const until = readUntil();
  return until !== null && now < until;
}

export function isProTrialActive(now = Date.now()): boolean {
  return isProDemoActive(now);
}

export function getProDemoRemainingMs(now = Date.now()): number {
  const until = readUntil();
  if (!until) return 0;
  return Math.max(0, until - now);
}

export function getProTrialRemainingMs(now = Date.now()): number {
  return getProDemoRemainingMs(now);
}

export function formatProDemoRemaining(ms: number): string {
  if (ms <= 0) return "ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days}d ${hours}h left`;
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin >= 60) return `${hours}h left`;
  return `${totalMin} min left`;
}

export function formatProTrialRemaining(ms: number): string {
  return formatProDemoRemaining(ms);
}

function notifyDemoChanged() {
  window.dispatchEvent(new Event(PRO_DEMO_CHANGED));
}

function writeTrialUntil(until: number, userId: string) {
  try {
    localStorage.setItem(PRO_TRIAL_UNTIL_KEY, String(until));
    localStorage.setItem(PRO_TRIAL_STARTED_KEY, "1");
    localStorage.setItem(PRO_TRIAL_USER_ID_KEY, userId);
    localStorage.removeItem(PRO_DEMO_UNTIL_KEY);
    // Complimentary grant is Next Level (BASIC), never Pantheon (PRO).
    localStorage.setItem(PLAN_STORAGE_KEY, "BASIC");
  } catch {
    /* ignore */
  }
  notifySynexusPlanChanged();
  notifyDemoChanged();
}

/** Strip expired trial Pro (keeps paid Pro / owner access). */
export function clearExpiredProDemo(now = Date.now()): boolean {
  const until = readUntil();
  if (!until || now < until) return false;

  try {
    localStorage.removeItem(PRO_TRIAL_UNTIL_KEY);
    localStorage.removeItem(PRO_DEMO_UNTIL_KEY);
  } catch {
    /* ignore */
  }

  const grantSource = readPlanGrantSource();
  const trialGrant = isSignupTrialGrantSource(grantSource);

  try {
    const plan = localStorage.getItem(PLAN_STORAGE_KEY);
    if (trialGrant && (plan === "PRO" || plan === "BASIC")) {
      localStorage.setItem(PLAN_STORAGE_KEY, "FREE");
      notifySynexusPlanChanged();
    }
  } catch {
    /* ignore */
  }

  notifyDemoChanged();
  return true;
}

export function clearExpiredProTrial(now = Date.now()): boolean {
  return clearExpiredProDemo(now);
}

/** Start the one-time 30-day Pro trial for a signed-in operator. No card. */
export function startProDemo(userId: string, now = Date.now()): number {
  if (!userId || userId.startsWith("demo-")) return now;
  clearExpiredProDemo(now);
  if (hasPaidProGrant()) return readUntil() ?? now;
  const until = now + PRO_TRIAL_DURATION_MS;
  writeTrialUntil(until, userId);
  return until;
}

export function startProTrial(userId: string, now = Date.now()): number {
  return startProDemo(userId, now);
}

/** Re-apply an active complimentary Next Level grant after reload. */
export function restoreProTrialGrant(userId: string, now = Date.now()): boolean {
  if (!userId || userId.startsWith("demo-")) return false;
  clearExpiredProDemo(now);
  if (hasPaidProGrant()) return false;

  const trialUserId = localStorage.getItem(PRO_TRIAL_USER_ID_KEY);
  if (!trialUserId || trialUserId !== userId || !isProTrialActive(now)) return false;

  try {
    if (localStorage.getItem(PLAN_STORAGE_KEY) !== "BASIC") {
      localStorage.setItem(PLAN_STORAGE_KEY, "BASIC");
    }
  } catch {
    /* ignore */
  }
  notifySynexusPlanChanged();
  notifyDemoChanged();
  return true;
}

/** Restore an active device trial before auth hydrates (same browser session). */
export function restoreActiveProTrialGrant(now = Date.now()): boolean {
  const trialUserId = localStorage.getItem(PRO_TRIAL_USER_ID_KEY);
  if (!trialUserId) return false;
  return restoreProTrialGrant(trialUserId, now);
}

/**
 * Local mirror helper for an already-started complimentary grant.
 * New grants must go through POST /api/membership/trial (server one-shot ledger).
 */
export function ensureProTrialAfterSignup(userId: string, now = Date.now()): boolean {
  if (!userId || userId.startsWith("demo-")) return false;
  clearExpiredProDemo(now);
  if (hasPaidProGrant()) return false;
  return restoreProTrialGrant(userId, now);
}

/** Restore a local complimentary grant mirror only — does not auto-start. */
export function syncProTrialForUser(userId: string, now = Date.now()): boolean {
  return restoreProTrialGrant(userId, now);
}

/** Mirror a server complimentary Next Level grant into local UI state. */
export function mirrorComplimentaryNextLevelGrant(userId: string, endsAt: string | null, now = Date.now()): void {
  if (!userId || userId.startsWith("demo-")) return;
  const ends = endsAt ? Date.parse(endsAt) : now + PRO_TRIAL_DURATION_MS;
  if (!Number.isFinite(ends) || ends <= now) return;
  writeTrialUntil(ends, userId);
}

/** @deprecated Use ensureProTrialAfterSignup after verified sign-in. */
export function ensureUniversalProTrial(now = Date.now()): boolean {
  void now;
  return false;
}

export function endProDemo() {
  try {
    localStorage.removeItem(PRO_TRIAL_UNTIL_KEY);
    localStorage.removeItem(PRO_DEMO_UNTIL_KEY);
    const grantSource = readPlanGrantSource();
    const plan = localStorage.getItem(PLAN_STORAGE_KEY);
    if (isSignupTrialGrantSource(grantSource) && (plan === "PRO" || plan === "BASIC")) {
      localStorage.setItem(PLAN_STORAGE_KEY, "FREE");
    }
  } catch {
    /* ignore */
  }
  notifySynexusPlanChanged();
  notifyDemoChanged();
}

export function endProTrial() {
  endProDemo();
}
