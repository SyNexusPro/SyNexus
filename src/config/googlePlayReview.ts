/** Google Play Console app-access reviewer account (email only — never ship the password in client code). */
export const GOOGLE_PLAY_REVIEW_EMAIL = "google-review@synexus.pro";

/** Owner god-mode ID (email only). Password stays on the server as SYNEXUS_OWNER_PASSWORD. */
export const SYNEXUS_OWNER_LOGIN_EMAIL = "thesynexuspro@gmail.com";

export function isGooglePlayReviewEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === GOOGLE_PLAY_REVIEW_EMAIL;
}

export function isAlwaysOnLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const value = email.trim().toLowerCase();
  return value === GOOGLE_PLAY_REVIEW_EMAIL || value === SYNEXUS_OWNER_LOGIN_EMAIL;
}
