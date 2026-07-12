import { SYNEXUS_PRO_TRIAL_MS } from "../config/proTrial";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { hasStoredOwnerGrant } from "./ownerAccess";
import { PLAN_STORAGE_KEY } from "./tradingFees";
import { recordTrustedPlanGrant } from "./securityBot";

/** Active trial end timestamp (ms). */
export const PRO_TRIAL_UNTIL_KEY = "synexus_pro_trial_until";
/** Legacy 5-minute demo key — read for migration only. */
export const PRO_DEMO_UNTIL_KEY = "synexus_pro_demo_until";
export const PRO_TRIAL_STARTED_KEY = "synexus_pro_trial_started";
export const PRO_TRIAL_USER_ID_KEY = "synexus_pro_trial_user_id";
export const PRO_DEMO_CHANGED = "synexus-pro-demo-changed";

export const PRO_DEMO_DURATION_MS = SYNEXUS_PRO_TRIAL_MS;
export const PRO_TRIAL_DURATION_MS = SYNEXUS_PRO_TRIAL_MS;

const PAID_GRANT_SOURCES = new Set(["subscription_checkout", "creem_checkout", "stripe_checkout", "supabase_profile", "owner", "admin"]);

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
    recordTrustedPlanGrant("PRO", "trial_7d");
    localStorage.setItem(PLAN_STORAGE_KEY, "PRO");
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
  const trialGrant = grantSource === "trial_7d" || grantSource === "demo_session";

  try {
    if (trialGrant && localStorage.getItem(PLAN_STORAGE_KEY) === "PRO") {
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

/** Start the one-time 7-day Pro trial for a signed-in operator. */
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

/**
 * Start the 7-day Pro trial after a verified sign-up / sign-in.
 * No credit card — app-granted access only.
 */
export function ensureProTrialAfterSignup(userId: string, now = Date.now()): boolean {
  if (!userId || userId.startsWith("demo-")) return false;
  clearExpiredProDemo(now);
  if (hasPaidProGrant()) return false;

  const trialUserId = localStorage.getItem(PRO_TRIAL_USER_ID_KEY);
  if (isProTrialActive(now)) {
    return trialUserId === userId;
  }

  if (hasProTrialBeenUsed(userId)) return false;

  startProDemo(userId, now);
  return true;
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
    if (
      (grantSource === "trial_7d" || grantSource === "demo_session") &&
      localStorage.getItem(PLAN_STORAGE_KEY) === "PRO"
    ) {
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
