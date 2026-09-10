/** Google Play Console app-access reviewer account (email only — never ship the password in client code). */
export const GOOGLE_PLAY_REVIEW_EMAIL = "google-review@synexus.pro";

export function isGooglePlayReviewEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === GOOGLE_PLAY_REVIEW_EMAIL;
}
