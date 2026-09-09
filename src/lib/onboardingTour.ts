import { ONBOARDING_TOUR_KEY } from "../config/onboardingTour";

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
