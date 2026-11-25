/**
 * Complimentary Next Level grant — one-time, no card.
 * This is an in-app promotional grant, not a Paddle / App Store / Play billing trial.
 */
export const SYNEXUS_PRO_TRIAL_DAYS = 30;

export const SYNEXUS_PRO_TRIAL_MS = SYNEXUS_PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000;

export const SYNEXUS_PRO_TRIAL_LABEL = `${SYNEXUS_PRO_TRIAL_DAYS}-day Next Level complimentary grant`;

export const SYNEXUS_PRO_TRIAL_GRANT_SOURCE = "trial_30d";

/** Stored grant ids that mean signup/device trial (not a paid subscription). */
export function isSignupTrialGrantSource(source: string | null | undefined): boolean {
  return source === "trial_30d" || source === "trial_7d" || source === "demo_session";
}

/** Shown near Enter Titan / checkout. */
export const SYNEXUS_PRO_TRIAL_CARD_NOTE =
  "No card needed — one-time 30-day Next Level grant (promotional access, not a store subscription trial)";
