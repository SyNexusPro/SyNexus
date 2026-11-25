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

/** Queue the one-time Hera guide after a real sign-up. No-ops if already shown. Opens Hera. */
export function queueHeraSignupDemo(): boolean {
  if (hasHeraSignupDemoBeenShown()) return false;
  try {
    localStorage.setItem(HERA_SIGNUP_DEMO_PENDING_KEY, "1");
  } catch {
    return false;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HERA_SIGNUP_DEMO_EVENT));
    // Open Hera so she can deliver the walkthrough (lazy import keeps this module light).
    void import("./openOracleLogin").then(({ openTitanChat }) => openTitanChat());
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

/** True while a signup walkthrough is queued (does not clear the flag). */
export function isHeraSignupDemoPending(): boolean {
  if (hasHeraSignupDemoBeenShown()) return false;
  try {
    return localStorage.getItem(HERA_SIGNUP_DEMO_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Spoken signup walkthrough: what SyNexus is + what you can do.
 * Keep it speakable — short sentences, no jargon stacks.
 */
export function buildHeraSignupDemoLine(operatorName?: string | null): string {
  const name = operatorName?.trim();
  const hello = name && name !== "there" ? `Hey ${name} — welcome to SyNexus.` : "Hey — welcome to SyNexus.";
  return (
    `${hello} I'm Hera. ` +
    `SyNexus is your home base for crypto: check a coin before you buy, talk to me anytime, and keep tabs on the market — ` +
    `and we never hold your money. You always approve trades in your own wallet. ` +
    `Here's what you can do. On Scan, paste a coin name or its long ID and get a plain answer: don't buy, wait, or looks okay. ` +
    `Tap Listen and say my name when you want me — ask about a coin, a scam, or anything else. ` +
    `Hub has extras like invites and SYN. Watchlist saves coins you care about once you're signed in. ` +
    `That's SyNexus. Ask me anything when you're ready.`
  );
}
