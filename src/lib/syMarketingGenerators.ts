/**
 * SyNexus Marketing Command Center — copy templates only (no outbound posting).
 * Tone: futuristic, clean, crypto-native, not hypey or scammy.
 */

const TAGS = "#SyNexus #Solana #DeFi";

export function marketingAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/** Short pricing / trial line (marketing phrasing — verify with your billing copy). */
const TRIAL_LINE = "First month free · $19.99/mo after trial on Nexus Pro.";

const THEMES = [
  "Risk surfaces fast — SyNexus Sentinels and Mother Core distill it into signal, not hype.",
  "The Nexus aligns momentum scans, whale context, patterns, and risk — before the crowd piles in.",
  "AI market intelligence with discipline: Sentinel-grade analysis built for sober execution.",
];

function pickThemes(n: number, offset: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(THEMES[(offset + i) % THEMES.length]!);
  }
  return out;
}

function salt(seed: number) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

export function generateXPost(now: number): string {
  const [t0, t1] = pickThemes(2, Math.floor(now / 60_000) % THEMES.length);
  return `${t0}\n${t1}\n${TRIAL_LINE}\n${TAGS}`;
}

export function generateTikTokScript(now: number): string {
  const s = salt(Math.floor(now / 1000));
  const hook =
    s < 0.33
      ? "Hook: Freeze on a chart caption — VO: Moved already? SyNexus Sentinels scout before clicks."
      : s < 0.66
        ? "Hook: Pan your watchlist. VO: Loud feed, silent risks unless you Nexus-scan first."
        : "Hook: About to ape. Freeze. VO: Mother Core + Sentinels pass first — then you choose.";

  return [
    `SyNexus — ${hook}`,
    "",
    `[0–3s] Mention lanes: Sentinel Aegis (risk), Sentinel Pulse (momentum), Sentinel Titan (whales), Sentinel Cipher (patterns). Mother Core fuses lanes for operator clarity.`,
    `[3–8s] On-screen: Nexus Pro — unlimited Nexus intelligence. ${TRIAL_LINE}`,
    `[8–12s] Brief app/The Nexus visuals. Whale tracking · momentum cues · Sentinel analysis.`,
    `[12–15s] Soft CTA: Try SyNexus — link out. Tags: ${TAGS}`,
  ].join("\n");
}

export function generateTelegramUpdate(now: number): string {
  const origin = marketingAppOrigin() || "https://your-live-app-url.com";
  return [
    "**SyNexus pulse · The Nexus**",
    "",
    pickThemes(1, Math.floor(now / 86_400_000))[0]!,
    "",
    "**Stack** · Sentinel analysis · risk scanning · whale + momentum overlays",
    `**Offer** · ${TRIAL_LINE}`,
    "",
    `**Live app** (paste when ready):\n${origin}`,
  ].join("\n");
}

export function generateDiscordPost(now: number): string {
  const origin = marketingAppOrigin() || "https://your-live-app-url.com";
  const t = pickThemes(1, Math.floor(now / 45_000))[0]!;
  return [
    "**SyNexus daily · The Nexus live**",
    t,
    "",
    "Mother Core threads Sentinel outputs into one operator-grade read — no spam, structured lanes.",
    `**Nexus Pro** · unlimited Nexus intelligence. ${TRIAL_LINE}`,
    "",
    `**App** · ${origin}`,
  ].join("\n");
}

export function generateRedditPost(now: number): string {
  const origin = marketingAppOrigin() || "https://your-live-app-url.com";
  const seed = Math.floor(now / 120_000);
  const title =
    seed % 3 === 0
      ? "[Showcase / Feedback] SyNexus command center — structuring Sentinel intelligence for SOL traders?"
      : seed % 3 === 1
        ? "Momentum vs noise — consolidated Nexus dashboards (SyNexus) vs scattered TG calls?"
        : "Anyone building calm risk overlays? SyNexus + Mother Core as a restrained alternative to hype raids.";

  const body = [
    "Posting as operator — sober feedback welcomed.",
    "",
    pickThemes(2, seed)[0]!,
    "",
    "**What SyNexus highlights** · Sentinel analysis across risk scanning, whale tracking, momentum detection, pattern reads — marketed as Nexus intelligence layered under The Nexus. Not financial advice, not guaranteed outcomes.",
    "",
    TRIAL_LINE,
    "",
    `Live demo / app · ${origin} (remove per subreddit rules if needed.)`,
  ].join("\n");

  return `TITLE:\n${title}\n\nBODY:\n${body}`;
}

export function generateReferralBlurb(now: number): string {
  const origin = marketingAppOrigin() || "https://your-live-app-url.com";
  const line = pickThemes(1, Math.floor(now / 90_000))[0]!;
  return [
    "Invite disciplined traders into SyNexus — The Nexus is your mission console for Sentinel-scale intelligence.",
    line,
    "",
    "They're not handing out entries — they're surfacing Sentinel analysis, whales, momentum, and risk overlays so convictions stay deliberate.",
    "",
    TRIAL_LINE,
    "",
    origin,
  ].join("\n");
}

/** Day-aligned mission (deterministic calendar day rotation). */
export function growthMissionLine(date: Date): string {
  const missions = [
    "Post one short video showing Sentinels surfacing elevated risk **before** a sketchy ape.",
    "Carousel: Sentinel Aegis (risk lane) vs Sentinel Titan (whale lane) framed under The Nexus.",
    "Film a TikTok teaser: whale tracking spotted a suspicious flow ahead of chatter.",
    "X mini-thread (3 posts): disciplined momentum cues vs meme hype — stay factual, cite SyNexus.",
    "Share a Nexused UI clip (blur keys): describe what Mother Core would emphasize for traders.",
    "Telegram changelog tone: Nexus Pro intelligence after trial at $19.99/m — FAQs, disclaimers intact.",
    "Discord micro-post inviting feedback on Sentinel alert hygiene — futuristic, moderation-friendly.",
    "Reddit-ready voice clip contrasting Telegram alpha chaos vs one Nexus recap.",
    "Drop the SyNexus app link alongside a single sober reason Sentinel scanning matters.",
    'Stitch headline about a rug headline with “Sentinels would have waved earlier” framing — no sensationalism.',
    "Celebrate user feedback calmly — futuristic SyNexus social proof minus flex.",
    "Record a TikTok reacting to overstated influencer calls versus structured Sentinel reads.",
  ];
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const idx = Math.floor(start / 86_400_000) % missions.length;
  return missions[idx]!;
}
