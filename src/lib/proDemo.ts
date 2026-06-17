import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { PLAN_STORAGE_KEY } from "./tradingFees";
import { recordTrustedPlanGrant } from "./securityBot";

export const PRO_DEMO_UNTIL_KEY = "synexus_pro_demo_until";
export const PRO_DEMO_CHANGED = "synexus-pro-demo-changed";

/** Five-minute full Pro preview — no payment required. */
export const PRO_DEMO_DURATION_MS = 5 * 60 * 1000;

function readUntil(): number | null {
  try {
    const raw = localStorage.getItem(PRO_DEMO_UNTIL_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function isProDemoActive(now = Date.now()): boolean {
  const until = readUntil();
  return until !== null && now < until;
}

export function getProDemoRemainingMs(now = Date.now()): number {
  const until = readUntil();
  if (!until) return 0;
  return Math.max(0, until - now);
}

export function formatProDemoRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function notifyDemoChanged() {
  window.dispatchEvent(new Event(PRO_DEMO_CHANGED));
}

/** Strip expired demo Pro (keeps paid Pro / owner access). */
export function clearExpiredProDemo(now = Date.now()): boolean {
  const until = readUntil();
  if (!until || now < until) return false;

  try {
    localStorage.removeItem(PRO_DEMO_UNTIL_KEY);
  } catch {
    /* ignore */
  }

  try {
    if (localStorage.getItem(PLAN_STORAGE_KEY) === "PRO") {
      localStorage.setItem(PLAN_STORAGE_KEY, "FREE");
      notifySynexusPlanChanged();
    }
  } catch {
    /* ignore */
  }

  notifyDemoChanged();
  return true;
}

export function startProDemo(now = Date.now()): number {
  clearExpiredProDemo(now);
  const until = now + PRO_DEMO_DURATION_MS;
  try {
    localStorage.setItem(PRO_DEMO_UNTIL_KEY, String(until));
    recordTrustedPlanGrant("PRO", "demo_session");
    localStorage.setItem(PLAN_STORAGE_KEY, "PRO");
  } catch {
    /* ignore */
  }
  notifySynexusPlanChanged();
  notifyDemoChanged();
  return until;
}

export function endProDemo() {
  try {
    localStorage.removeItem(PRO_DEMO_UNTIL_KEY);
    if (localStorage.getItem(PLAN_STORAGE_KEY) === "PRO") {
      localStorage.setItem(PLAN_STORAGE_KEY, "FREE");
    }
  } catch {
    /* ignore */
  }
  notifySynexusPlanChanged();
  notifyDemoChanged();
}
