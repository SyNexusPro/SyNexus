/**
 * Synexus Marketing Command Center — copy templates only (no outbound posting).
 * Voice: simple, grabby, plain English. Lead with "Should I buy this?"
 */

import { SYNEXUS_PRO_OFFER_SHORT, SYNEXUS_PRO_PRICE_SHORT } from "../config/proPricing";

const TAGS = "#Synexus #Solana #Crypto #ShouldIBuyThis";

export function marketingAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

const PRO_PRICE_LINE = `Synexus Pro · ${SYNEXUS_PRO_PRICE_SHORT} · cancel anytime.`;
const TRIAL_OFFER_SHORT = SYNEXUS_PRO_OFFER_SHORT;

const HOOKS = [
  "Should I buy this? Paste any Solana token. Synexus answers in seconds.",
  "About to ape? Paste the mint first. Avoid · Watch · OK — in plain English.",
  "One paste. One verdict. Risk, whales, and rug flags before you sign.",
  "Stop guessing. Paste a token — Synexus tells you if it's worth the click.",
  "Memecoin moving? Freeze. Paste it. Read Avoid or Watch before you buy.",
  "Trading Solana? Paste any coin. Get a simple scorecard + plain-English read.",
];

const SUPPORT = [
  "Sign up → 7-day Pro trial with card on file. Then $9.99/mo if you keep it.",
  "Free scan on every token. Pro unlocks Titan briefings + full Sentinel grid.",
  "Your wallet signs every trade — Synexus just shows you the risk first.",
  "Trade journal tracks entries, exits, and P/L so you see your habits.",
  "Live alerts when whales move or risk spikes — before the timeline screams.",
];

function pick(list: string[], offset: number) {
  return list[offset % list.length]!;
}

function salt(seed: number) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function dayOffset(now: number) {
  return Math.floor(now / 86_400_000);
}

export function generateXPost(now: number): string {
  const hook = pick(HOOKS, dayOffset(now));
  const support = pick(SUPPORT, dayOffset(now) + 1);
  const origin = marketingAppOrigin() || "https://synexus.pro";
  return [hook, "", support, "", `Try free → ${origin}`, TRIAL_OFFER_SHORT, PRO_PRICE_LINE, TAGS].join("\n");
}

export function generateTikTokScript(now: number): string {
  const hook = pick(HOOKS, dayOffset(now));
  const s = salt(Math.floor(now / 1000));
  const onScreen =
    s < 0.33 ? "SHOULD I BUY THIS?" : s < 0.66 ? "PASTE TOKEN → GET VERDICT" : "AVOID · WATCH · OK";
  const origin = marketingAppOrigin() || "https://synexus.pro";

  return [
    `Synexus — Hook: Big text "${onScreen}" — VO: ${hook}`,
    "",
    `[0–3s] Show paste box + instant verdict card (Avoid / Watch / OK).`,
    `[3–7s] Flash scorecard: risk · whales · momentum · liquidity · rug warning.`,
    `[7–11s] One line: "Not financial advice — you still sign in your wallet."`,
    `[11–15s] CTA on screen: 7-day free Pro trial · ${origin} · ${TRIAL_OFFER_SHORT}`,
    "",
    `Tags: ${TAGS}`,
  ].join("\n");
}

export function generateTelegramUpdate(now: number): string {
  const origin = marketingAppOrigin() || "https://synexus.pro";
  const hook = pick(HOOKS, dayOffset(now));
  return [
    "**Should I buy this?**",
    "",
    hook,
    "",
    "**How it works**",
    "1️⃣ Paste a Solana mint or symbol",
    "2️⃣ Get **Avoid**, **Watch**, or **OK** + plain English",
    "3️⃣ See risk score, whales, rug flags — then you decide",
    "",
    "**Also inside** · trade journal · wallet stats · live alerts",
    "",
    `**Try free** → ${origin}`,
    TRIAL_OFFER_SHORT,
    PRO_PRICE_LINE,
    "",
    "🐰 Syn · paste before you ape",
  ].join("\n");
}

export function generateDiscordPost(now: number): string {
  const origin = marketingAppOrigin() || "https://synexus.pro";
  const hook = pick(HOOKS, dayOffset(now));
  return [
    "**Should I buy this? — Synexus**",
    "",
    hook,
    "",
    "Paste any Solana token → **Avoid · Watch · OK** in plain English.",
    "Plus: risk scorecard, whale read, trade journal, and Sentinel alerts.",
    "",
    `**Try free** · ${origin}`,
    TRIAL_OFFER_SHORT,
    PRO_PRICE_LINE,
    "",
    "🐰 **Syn** says: paste before you ape.",
  ].join("\n");
}

export function generateRedditPost(now: number): string {
  const origin = marketingAppOrigin() || "https://synexus.pro";
  const seed = dayOffset(now);
  const titles = [
    "I built a free \"Should I buy this?\" scanner for Solana — paste a mint, get Avoid/Watch/OK in plain English",
    "Before you ape: paste any SOL token and get a risk score + plain-English read (Synexus)",
    "Anyone else tired of TG hype? Made a simple Solana token scanner — paste → verdict → you decide",
  ];
  const title = pick(titles, seed);

  const body = [
    "Not shilling a coin — sharing a tool I use before every buy.",
    "",
    pick(HOOKS, seed),
    "",
    "**What it does (simple):**",
    "- Paste mint or symbol",
    "- Get Avoid, Watch, or OK + why in plain English",
    "- Risk score, whale activity, liquidity, rug-pull flags",
    "- Optional trade journal so you track wins/losses over time",
    "",
    "Non-custodial — your wallet signs every swap. Not financial advice.",
    "",
    TRIAL_OFFER_SHORT,
    PRO_PRICE_LINE,
    "",
    `Try it: ${origin}`,
    "",
    "🐰 Syn the bunny · paste before you ape",
  ].join("\n");

  return `TITLE:\n${title}\n\nBODY:\n${body}`;
}

export function generateReferralBlurb(now: number): string {
  const origin = marketingAppOrigin() || "https://synexus.pro";
  const hook = pick(HOOKS, dayOffset(now));
  return [
    "Know someone who apes without checking risk?",
    "",
    hook,
    "",
    "Send them Synexus — paste a token, get a clear answer, trade on their own terms.",
    "",
    TRIAL_OFFER_SHORT,
    PRO_PRICE_LINE,
    "",
    origin,
  ].join("\n");
}

export function growthMissionLine(date: Date): string {
  const missions = [
    'Post a reel: on-screen text "7-day Pro free when you sign up" + paste → Avoid/Watch demo.',
    'Post a 15s clip: paste a trending ticker → show the "Avoid" or "Watch" verdict on screen.',
    "Screen record: sign up → show 7-day Pro trial banner → scan BONK in Should I buy?",
    'TikTok text overlay: "7 days Pro free · card on file · $9.99/mo after."',
    "X thread (3 tweets): aping blind → paste verdict fix → 7-day free trial link.",
    "Telegram: pin the offer — 7-day Pro trial, sign up free, $9.99/mo after.",
    "Discord: share one Avoid verdict + trial offer in footer — educational not hype.",
    "Reddit comment: mention free scan + 7-day Pro trial after sign-up — no spam.",
    "Film wallet journal stats — people love seeing their own win rate.",
    "Compare: influencer \"100x gem\" vs Synexus Danger band on the same token.",
    'Short: "3 seconds to paste. 5 seconds to know if you should touch it."',
    "Carousel: Avoid vs Watch vs OK — what each means in one sentence each.",
    "Story/Reel: Titan sign-up gate + Should I buy? demo — end card with trial offer.",
  ];
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const idx = Math.floor(start / 86_400_000) % missions.length;
  return missions[idx]!;
}

export function generateTikTokCaption(now: number): string {
  const hook = pick(HOOKS, dayOffset(now));
  const origin = marketingAppOrigin() || "https://synexus.pro";
  return [
    hook,
    "",
    "Paste mint or symbol → Avoid · Watch · OK",
    "Risk · whales · rug flags · trade journal",
    "",
    `Free scan → ${origin}`,
    TRIAL_OFFER_SHORT,
    PRO_PRICE_LINE,
    "",
    "🐰 Syn the bunny · paste before you ape",
    "#Synexus #Solana #Crypto #Trading #Memecoin #ShouldIBuyThis #DeFi",
  ].join("\n");
}
