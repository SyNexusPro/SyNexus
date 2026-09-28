import { PUBLIC_SITE_URL } from "../config/site";

/** Supabase password-reset emails should return here (public site, not preview hosts). */
export const PASSWORD_RECOVERY_REDIRECT = "/pulse?auth=recovery";

export function passwordResetInboxMessage(email: string): string {
  return `We sent a reset link to ${email}. Open it from your inbox — you'll come back to SyNexus to choose a new password (check spam if needed).`;
}

/** If a recovery link lands on home or another route, forward to Pulse where reset UI lives. */
export function routePasswordRecoveryToPulse(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const q = url.searchParams;

  const recovery =
    q.get("auth") === "recovery" ||
    q.get("type") === "recovery" ||
    hash.get("type") === "recovery";
  const authCallback = q.has("code") || hash.has("access_token");

  if (!recovery && !authCallback) return;
  if (url.pathname === "/pulse" && !/\.vercel\.app$/i.test(url.hostname)) return;

  const baseOrigin = /\.vercel\.app$/i.test(url.hostname)
    ? PUBLIC_SITE_URL.replace(/\/$/, "")
    : url.origin;
  const target = new URL(PASSWORD_RECOVERY_REDIRECT, baseOrigin);
  q.forEach((value, key) => {
    if (key !== "auth") target.searchParams.set(key, value);
  });
  if (url.hash) target.hash = url.hash;
  window.location.replace(`${target.pathname}${target.search}${target.hash}`);
}
