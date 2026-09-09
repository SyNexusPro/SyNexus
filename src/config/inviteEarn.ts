/** Invite 3 verified customers → 30 days of Pro Titan. One reward per customer. */

export const INVITE_REQUIRED_COUNT = 3;
export const INVITE_REWARD_DAYS = 30;
export const INVITE_CARD_VERIFY_CENTS = 100;
export const INVITE_MIN_AGE = 18;

export const INVITE_CODE_STORAGE_KEY = "synexus_invite_code";
export const INVITE_REWARD_UNTIL_KEY = "synexus_invite_reward_until";

export function buildInviteUrl(code: string, origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(
    /\/$/,
    "",
  );
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return `${base}/invite`;
  return `${base}/invite/${encodeURIComponent(trimmed)}`;
}
