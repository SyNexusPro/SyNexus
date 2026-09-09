/** Shared QA / multi-tester login (password never shipped in client). */

export const SHARED_TESTER_EMAIL = "tester@synexus.pro";

/** Pro access ends at this instant (30 days from 2026-08-16). */
export const SHARED_TESTER_PRO_UNTIL_ISO = "2026-09-15T23:59:59.000Z";

export function isSharedTesterEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SHARED_TESTER_EMAIL;
}

export function isSharedTesterProActive(now = Date.now()): boolean {
  const until = Date.parse(SHARED_TESTER_PRO_UNTIL_ISO);
  return Number.isFinite(until) && now < until;
}
