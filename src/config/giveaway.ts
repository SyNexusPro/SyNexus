import { PUBLIC_SITE_URL } from "./site";

/** Launch giveaway window (UTC). Keep in sync with supabase/giveaway.sql. */
export const GIVEAWAY_START_ISO = "2026-06-12T00:00:00.000Z";
export const GIVEAWAY_END_ISO = "2026-07-12T23:59:59.000Z";

export const GIVEAWAY_PRIZES = [
  {
    id: "grand",
    rank: "Grand Prize",
    title: "Apple iPad (11th Generation)",
    emoji: "🏆",
  },
  {
    id: "second",
    rank: "Second Prize",
    title: "Apple AirPods Pro (2nd Generation)",
    emoji: "🥈",
  },
  {
    id: "visa",
    rank: "Additional Winners",
    title: "Five $50 Visa Gift Cards",
    emoji: "🥉",
  },
] as const;

export const GIVEAWAY_ENTRY_RULES = [
  { id: "signup", label: "Create a free Synexus account", entries: 1, required: true },
  { id: "email", label: "Verify your email address", entries: 0, required: true },
  { id: "profile", label: "Complete your profile", entries: 1, required: true },
] as const;

export const GIVEAWAY_BONUS_RULES = [
  { id: "profile", label: "Complete your profile", entries: 1 },
  { id: "referral", label: "Invite a friend who signs up & verifies", entries: 5 },
  { id: "social", label: "Share Synexus.pro on social media", entries: 2 },
  { id: "daily", label: "Log in each day during the giveaway", entries: 1 },
] as const;

export const GIVEAWAY_REF_STORAGE_KEY = "synexus_giveaway_ref";

export function isGiveawayActive(now = Date.now()): boolean {
  const start = Date.parse(GIVEAWAY_START_ISO);
  const end = Date.parse(GIVEAWAY_END_ISO);
  return now >= start && now <= end;
}

export function buildGiveawayReferralLink(code: string): string {
  const base = PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${base}/giveaway?ref=${encodeURIComponent(code)}`;
}

export function buildGiveawayShareText(referralLink: string): string {
  return [
    "Synexus.pro Launch Giveaway — win an iPad, AirPods Pro, or $50 Visa gift cards!",
    "",
    "Free Solana token scans + Sentinel risk scores. Join early:",
    referralLink,
    "",
    "No purchase necessary. See official rules on synexus.pro/giveaway",
  ].join("\n");
}
