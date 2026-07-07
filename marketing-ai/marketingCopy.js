/**
 * Synexus marketing voice — SyNexus Viral Content System v1.0
 * Curiosity titles · natural VO · purple brand
 */

import { curiosityTitle, primaryCta } from "./viralContentSystem.js";
import {
  PRO_LINE,
  TRIAL_OFFER_LINE,
  TRIAL_OFFER_SHORT,
  TRIAL_OFFER_SOCIAL,
} from "./pricing.js";

function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "https://synexus.pro";
}

export const TRUST_LINE = "Non-custodial · You sign every trade · Not financial advice.";
export { PRO_LINE, TRIAL_OFFER_LINE, TRIAL_OFFER_SHORT, TRIAL_OFFER_SOCIAL };

const CTA_VARIANTS = [
  "Download SyNexus and let the AI check your next coin.",
  "Paste your next mint in SyNexus — free scan.",
  "Try SyNexus before you sign your next trade.",
];

const BADASS_CLOSES = [
  "Don't be exit liquidity.",
  "Scan first. Ape second.",
  "The chart lies. I don't.",
  "Paste it. Read it. Then decide.",
  "They want you blind. Don't give them that.",
  "One paste. One verdict. Move.",
  "Your wallet signs. My job is the read.",
  "Rug season doesn't sleep. Neither do I.",
];

const YOUTUBE_TITLE_PREFIXES = [
  "Stop — ",
  "Before You Ape: ",
  "Solana: ",
  "They Don't Want You To See This — ",
  "Exit Liquidity Alert — ",
  "Scan This Mint — ",
];

function pickCta(seed = 0) {
  return primaryCta(seed) || CTA_VARIANTS[Math.abs(seed) % CTA_VARIANTS.length];
}

function pickClose(seed = 0) {
  return BADASS_CLOSES[Math.abs(seed) % BADASS_CLOSES.length];
}

function seedFromId(id = "") {
  return String(id).split("").reduce((n, c) => n + c.charCodeAt(0), 0);
}

function firstSentence(text, max = 90) {
  const t = String(text || "").trim();
  const m = t.match(/^[^.!?]+[.!?]?/);
  const s = (m ? m[0] : t).trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}

function tighten(text, max = 140) {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function stripTelegramMeta(text) {
  return String(text)
    .replace(/\bjoin (alerts|telegram|the channel)\b[^.]*\.?/gi, "")
    .replace(/\blink in bio\b\.?/gi, "")
    .replace(/\btelegram for[^.]*\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Spoken VO — hook slaps, body hits, close lands. Female Sentinel operator. */
export function buildLaunchVoiceover({ hook, build, payoff, loop, id = "" }) {
  const seed = seedFromId(id);
  const hookLine = firstSentence(hook, 85);
  const buildLine = tighten(build, 110);
  const payoffLine = tighten(payoff, 95);
  const close = loop?.trim() ? firstSentence(loop, 70) : pickClose(seed);

  return [
    hookLine.endsWith(".") || hookLine.endsWith("!") || hookLine.endsWith("?") ? hookLine : `${hookLine}.`,
    buildLine,
    payoffLine,
    close.endsWith(".") || close.endsWith("!") ? close : `${close}.`,
    pickCta(seed),
    "Not financial advice.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 880);
}

/** Catchy YouTube title — curiosity-first (v1.0). */
export function buildYouTubeTitle({ hook, id = "", titleBase = "" }) {
  if (titleBase?.trim()) return titleBase.trim().slice(0, 95);
  const seed = seedFromId(id);
  return curiosityTitle(seed + seedFromId(hook)).slice(0, 95);
}

/** Telegram channel — intel brief, never "join Telegram" on Telegram. */
export function buildTelegramCaption({ hook, build, payoff, loop, id = "" }) {
  const origin = appOrigin();
  const seed = id.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  const cta = pickCta(seed);

  let headline = stripTelegramMeta(hook) || hook;
  if (/telegram/i.test(String(hook))) {
    headline = stripTelegramMeta(payoff) || stripTelegramMeta(build) || headline;
  }

  const body = [stripTelegramMeta(build), stripTelegramMeta(payoff)]
    .filter(Boolean)
    .filter((line, i, arr) => arr.indexOf(line) === i)
    .join("\n\n");

  const tail = stripTelegramMeta(loop);
  const lines = [
    `**Synexus Sentinel** · ${headline}`,
    "",
    body,
    tail && tail !== headline ? `\n_${tail}_` : "",
    "",
    `**${cta}** ${origin}`,
    "",
    TRIAL_OFFER_SHORT,
    "",
    TRUST_LINE,
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildXCaption({ hook, build, payoff, id = "" }) {
  const origin = appOrigin();
  const seed = id.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  const insight = stripTelegramMeta(payoff) || stripTelegramMeta(build);
  const lines = [
    hook,
    insight,
    `${pickCta(seed)} ${origin}`,
    TRIAL_OFFER_SHORT,
    "#Synexus #Solana",
  ].filter(Boolean);
  const text = lines.join("\n\n");
  return text.length <= 280 ? text : `${text.slice(0, 277)}…`;
}

export function buildTikTokCaption({ hook, build, payoff, id = "" }) {
  const origin = appOrigin();
  return [
    hook,
    "",
    stripTelegramMeta(build),
    "",
    stripTelegramMeta(payoff),
    "",
    `${pickCta(id.length)} ${origin}`,
    "",
    TRIAL_OFFER_SHORT,
    "",
    "#Synexus #Solana #ShouldIBuyThis #Crypto #Shorts",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildYouTubeMeta({ hook, build, payoff, id = "", titleBase = "" }) {
  const origin = appOrigin();
  const title = buildYouTubeTitle({ hook, id, titleBase });
  const description = [
    "Synexus Sentinel — Solana risk reads before you sign.",
    "",
    hook,
    "",
    stripTelegramMeta(build),
    "",
    stripTelegramMeta(payoff),
    "",
    "Paste any mint → Avoid · Watch · OK in seconds.",
    "",
    `Free scan: ${origin}`,
    "",
    TRIAL_OFFER_LINE,
    "",
    TRUST_LINE,
    "",
    "#Synexus #Solana #ShouldIBuyThis #Crypto #Shorts #Trading",
  ].join("\n");

  return {
    title,
    description,
    tags: "Synexus, Should I buy this, Solana, crypto, token scanner, Sentinel, rug pull, memecoin",
  };
}

/** Daily blast Telegram — 3 distinct briefs, no bunny spam. */
export function buildDailyTelegramBrief({ hook, slot = 0 }) {
  const origin = appOrigin();
  const frames = [
    {
      label: "Morning pulse",
      lead: "Overnight risk lanes are active. Paste before the open.",
    },
    {
      label: "Midday scan",
      lead: "Three signals fused: liquidity, whales, momentum.",
    },
    {
      label: "Evening watch",
      lead: "Sentinel grid stays live while you sleep.",
    },
  ];
  const frame = frames[slot % frames.length];

  return [
    `**${frame.label}** · Synexus`,
    "",
    hook,
    "",
    frame.lead,
    "Paste any Solana mint → **Avoid · Watch · OK** with a plain-English reason code.",
    "",
    `**Scan** → ${origin}`,
    "",
    TRIAL_OFFER_SHORT,
    "",
    TRUST_LINE,
  ].join("\n");
}

export function buildDailyVoiceover(hook) {
  const seed = seedFromId(String(hook));
  const hookLine = firstSentence(hook, 80);
  return [
    hookLine.endsWith(".") || hookLine.endsWith("!") || hookLine.endsWith("?") ? hookLine : `${hookLine}.`,
    "Here's the problem — most traders never scan the mint before they ape.",
    "Synexus answers should I buy this in seconds: Avoid, Watch, or OK.",
    pickCta(seed),
    "Not financial advice.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 720);
}

export function buildSocialCaption({ hook, platform = "facebook" }) {
  const origin = appOrigin();
  const tags =
    platform === "instagram"
      ? "#Synexus #Solana #Crypto #Trading #ShouldIBuyThis #Reels"
      : "#Synexus #Solana #Crypto #ShouldIBuyThis";

  return [
    hook,
    "",
    "Sentinel read in seconds — Avoid · Watch · OK.",
    "Non-custodial. You sign every trade.",
    "",
    `Scan → ${origin}`,
    "",
    TRIAL_OFFER_SHORT,
    "",
    tags,
  ].join("\n");
}

export function buildDiscordPost({ hook, build, payoff }) {
  const origin = appOrigin();
  return [
    `**Synexus Sentinel** — ${hook}`,
    "",
    stripTelegramMeta(build),
    "",
    stripTelegramMeta(payoff),
    "",
    `Scan → ${origin}`,
    "",
    TRIAL_OFFER_SHORT,
    "",
    TRUST_LINE,
  ].join("\n");
}

export { appOrigin, stripTelegramMeta };
