/** SyNexusPro trial — full Pro for 30 days after sign-up. No card required. */
export const SYNEXUS_PRO_TRIAL_DAYS = 30;

export const SYNEXUS_PRO_TRIAL_MS = SYNEXUS_PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000;

export const SYNEXUS_PRO_TRIAL_LABEL = `${SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial`;

export const SYNEXUS_PRO_TRIAL_GRANT_SOURCE = "trial_30d";

/** Stored grant ids that mean signup/device trial (not paid Square). */
export function isSignupTrialGrantSource(source: string | null | undefined): boolean {
  return source === "trial_30d" || source === "trial_7d" || source === "demo_session";
}

/** Shown near Enter Titan / checkout. */
export const SYNEXUS_PRO_TRIAL_CARD_NOTE = "No card needed — 30 days of Pro free when you sign up";
