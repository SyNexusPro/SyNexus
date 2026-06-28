/**
 * Synexus premium marketing voice — institutional AI, not spam.
 * Matte-black brand: precise, synthetic authority, trust-first.
 */

function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "https://synexus.pro";
}

export const TRUST_LINE = "Non-custodial · You sign every trade · Not financial advice.";
export const PRO_LINE = "Synexus Pro · $19.99/mo · cancel anytime";

const CTA_VARIANTS = [
  "Run a free scan →",
  "Open the Sentinel read →",
  "Verify before you sign →",
  "Scan the mint →",
];

function pickCta(seed = 0) {
  return CTA_VARIANTS[Math.abs(seed) % CTA_VARIANTS.length];
}

function stripTelegramMeta(text) {
  return String(text)
    .replace(/\bjoin (alerts|telegram|the channel)\b[^.]*\.?/gi, "")
    .replace(/\blink in bio\b\.?/gi, "")
    .replace(/\btelegram for[^.]*\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Spoken VO — one arc, no boilerplate stacking. */
export function buildLaunchVoiceover({ hook, build, payoff, loop, id = "" }) {
  const seed = id.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  const parts = [hook, build, payoff, loop].map((p) => String(p || "").trim()).filter(Boolean);
  const close =
    seed % 3 === 0
      ? "Free scan at synexus dot pro."
      : seed % 3 === 1
        ? "Sentinel read in seconds at synexus dot pro."
        : "Verify the mint before you connect — synexus dot pro.";
  return [...parts, close, "Not financial advice."].join(" ").replace(/\s+/g, " ").slice(0, 880);
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
    TRUST_LINE,
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildXCaption({ hook, build, payoff, id = "" }) {
  const origin = appOrigin();
  const seed = id.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  const insight = stripTelegramMeta(payoff) || stripTelegramMeta(build);
  const lines = [hook, insight, `${pickCta(seed)} ${origin}`, "#Synexus #Solana"].filter(Boolean);
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
    "#Synexus #Solana #ShouldIBuyThis #Crypto #Shorts",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildYouTubeMeta({ hook, build, payoff, id = "", titleBase = "" }) {
  const origin = appOrigin();
  const title = (titleBase || `${hook.slice(0, 55)} · Synexus Sentinel`).slice(0, 95);
  const description = [
    "Synexus — Sentinel-grade Solana token intelligence.",
    "",
    hook,
    "",
    stripTelegramMeta(build),
    "",
    stripTelegramMeta(payoff),
    "",
    `Free scan: ${origin}`,
    "",
    TRUST_LINE,
    "",
    "#Synexus #Solana #ShouldIBuyThis #Crypto #Shorts",
  ].join("\n");

  return {
    title,
    description,
    tags: "Synexus, Should I buy this, Solana, crypto, token scanner, Sentinel, risk score",
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
    TRUST_LINE,
  ].join("\n");
}

export function buildDailyVoiceover(hook) {
  const short = String(hook).split(".")[0]?.trim() || hook;
  return [
    short.endsWith(".") ? short : `${short}.`,
    "Synexus fuses Sentinel lanes into one read — Avoid, Watch, or OK.",
    "Liquidity, whale concentration, and rug flags — before you sign.",
    "Free at synexus dot pro.",
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
    TRUST_LINE,
  ].join("\n");
}

export { appOrigin, stripTelegramMeta };
