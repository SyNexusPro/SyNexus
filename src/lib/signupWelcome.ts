import { SYNEXUS_BRAND_NAME } from "../config/brand";

export const SIGNUP_CONFIRM_REDIRECT = "/pulse?welcome=1";

export const SIGNUP_WELCOME_ACTIVE = `Welcome to ${SYNEXUS_BRAND_NAME} — your subscription is active.`;

const AWAITING_WELCOME_KEY = "synexus_awaiting_signup_welcome";

export function signupConfirmInboxMessage(email: string): string {
  return `We sent a confirmation link to ${email}. Open that link to activate your account.`;
}

export function markAwaitingSignupWelcome(): void {
  try {
    localStorage.setItem(AWAITING_WELCOME_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeAwaitingSignupWelcome(): boolean {
  try {
    if (localStorage.getItem(AWAITING_WELCOME_KEY) !== "1") return false;
    localStorage.removeItem(AWAITING_WELCOME_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasSignupWelcomeParam(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("welcome") === "1";
}
