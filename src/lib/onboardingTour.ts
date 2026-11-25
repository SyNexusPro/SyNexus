import { ONBOARDING_TOUR_KEY, ONBOARDING_TOUR_VOICE_KEY } from "../config/onboardingTour";

/** Keep in sync with `HERA_SIGNUP_DEMO_PENDING_KEY` — avoid importing that module (cycle). */
const HERA_SIGNUP_DEMO_PENDING_KEY = "synexus_hera_signup_demo_pending";

export function readOnboardingTourVoice(): boolean | null {
  try {
    const v = localStorage.getItem(ONBOARDING_TOUR_VOICE_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function saveOnboardingTourVoice(on: boolean): void {
  try {
    localStorage.setItem(ONBOARDING_TOUR_VOICE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function hasCompletedOnboardingTour(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_TOUR_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingTourComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_TOUR_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function wantsForcedOnboardingTour(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("tour") === "1";
}

/** First visit: auto spotlight once. Skip if already done or Hera signup guide is queued. */
export function shouldAutoStartOnboardingTour(): boolean {
  if (hasCompletedOnboardingTour()) return false;
  try {
    if (localStorage.getItem(HERA_SIGNUP_DEMO_PENDING_KEY) === "1") return false;
  } catch {
    /* ignore */
  }
  return true;
}

const REPLAY_KEY = "synexus_onboarding_replay";
export const ONBOARDING_REPLAY_EVENT = "synexus-onboarding-replay";

export function requestWelcomeReplay(): void {
  try {
    sessionStorage.setItem(REPLAY_KEY, "1");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ONBOARDING_REPLAY_EVENT));
}

export function hasWelcomeReplay(): boolean {
  try {
    return sessionStorage.getItem(REPLAY_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearWelcomeReplay(): void {
  try {
    sessionStorage.removeItem(REPLAY_KEY);
  } catch {
    /* ignore */
  }
}

const LEGAL_PREFIXES = [
  "/terms",
  "/privacy",
  "/disclaimer",
  "/account-deletion",
  "/data-deletion",
  "/refund-policy",
];

export function isOnboardingTourRoute(pathname: string): boolean {
  return !LEGAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
