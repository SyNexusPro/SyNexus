import { markOnboardingTourComplete } from "./onboardingTour";

export const HERA_SIGNUP_DEMO_PENDING_KEY = "synexus_hera_signup_demo_pending";
export const HERA_SIGNUP_DEMO_DONE_KEY = "synexus_hera_signup_demo_done";
export const HERA_SIGNUP_DEMO_EVENT = "synexus-hera-signup-demo";

export function hasHeraSignupDemoBeenShown(): boolean {
  try {
    return localStorage.getItem(HERA_SIGNUP_DEMO_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHeraSignupDemoComplete(): void {
  try {
    localStorage.setItem(HERA_SIGNUP_DEMO_DONE_KEY, "1");
    localStorage.removeItem(HERA_SIGNUP_DEMO_PENDING_KEY);
  } catch {
    /* ignore */
  }
  markOnboardingTourComplete();
}

/** Queue the one-time Hera guide after a real sign-up. No-ops if already shown. */
export function queueHeraSignupDemo(): boolean {
  if (hasHeraSignupDemoBeenShown()) return false;
  try {
    localStorage.setItem(HERA_SIGNUP_DEMO_PENDING_KEY, "1");
  } catch {
    return false;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HERA_SIGNUP_DEMO_EVENT));
  }
  return true;
}

export function consumeHeraSignupDemoPending(): boolean {
  if (hasHeraSignupDemoBeenShown()) {
    try {
      localStorage.removeItem(HERA_SIGNUP_DEMO_PENDING_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
  try {
    if (localStorage.getItem(HERA_SIGNUP_DEMO_PENDING_KEY) !== "1") return false;
    localStorage.removeItem(HERA_SIGNUP_DEMO_PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

export function buildHeraSignupDemoLine(operatorName?: string | null): string {
  const name = operatorName?.trim();
  const hello = name && name !== "there" ? `Welcome to SyNexus, ${name}.` : "Welcome to SyNexus.";
  return `${hello} I'm Hera — this is your one-time walkthrough. Paste a token on Scan for Avoid, Watch, or OK. Tap Listen and say my name when you want me. Hub is $SYN, invites, and staking. That's the map — ask me anything when you're ready.`;
}
