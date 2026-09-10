/** SyNexus hype sheet — 10 split panels + captions (v1.0 viral system). */

export const HYPE_GRID = {
  colW: 205,
  heroH: 360,
  shortY: 360,
  shortH: 200,
  cols: 5,
};

export const HYPE_ASSETS = [
  {
    id: "whale-alert",
    row: "hero",
    col: 0,
    headline: "WHALE ALERT!",
    tagline: "SyNexus AI spotted it first",
    hook: "This crypto mistake costs people millions. SyNexus AI spotted the whale move first.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "rise-above",
    row: "hero",
    col: 1,
    headline: "RISE ABOVE",
    tagline: "SyNexus AI never sleeps",
    hook: "Would AI have stopped this scam? SyNexus reads risk before the chart lies.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "level-up",
    row: "hero",
    col: 2,
    headline: "LEVEL UP",
    tagline: "AI powered. Always ahead.",
    hook: "I tested the smartest crypto assistant. This is what actually happened.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "ai-mode",
    row: "hero",
    col: 3,
    headline: "AI MODE",
    tagline: "SyNexus takes control",
    hook: "Can AI actually beat human traders? SyNexus Sentinel says scan first.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "to-the-moon",
    row: "hero",
    col: 4,
    headline: "TO THE MOON",
    tagline: "SyNexus AI fueling gains",
    hook: "The biggest crypto mistake beginners make — aping without a read.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "ai-sees",
    row: "short",
    col: 0,
    headline: "AI SEES",
    tagline: "What others miss",
    hook: "How scammers trick thousands every day — and how AI catches the pattern.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "fast-moves",
    row: "short",
    col: 1,
    headline: "FAST MOVES",
    tagline: "Catch big gains",
    hook: "This AI found a crypto scam before anyone else.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "burn-risk",
    row: "short",
    col: 2,
    headline: "BURN RISK",
    tagline: "Not your portfolio",
    hook: "Exit liquidity is real. SyNexus flags it before you sign.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "trust-ai",
    row: "short",
    col: 3,
    headline: "TRUST AI",
    tagline: "Not hype",
    hook: "The chart lies. The Sentinel read doesn't.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
  {
    id: "ai-chill",
    row: "short",
    col: 4,
    headline: "AI WORKS",
    tagline: "While you chill",
    hook: "I tested an AI crypto assistant for 30 days — here's the truth.",
    cta: "Download SyNexus and let the AI check your next coin.",
  },
];

/** Hand-cut creative filenames → catalog ids (drop files in assets/hype-creatives/). */
export const CREATIVE_SLOTS = [
  { prefix: "01-whale-alert", id: "whale-alert" },
  { prefix: "02-rise-above", id: "rise-above" },
  { prefix: "03-level-up", id: "level-up" },
  { prefix: "04-ai-mode", id: "ai-mode" },
  { prefix: "05-to-the-moon", id: "to-the-moon" },
  { prefix: "06-ai-sees", id: "ai-sees" },
  { prefix: "07-fast-moves", id: "fast-moves" },
  { prefix: "08-burn-risk", id: "burn-risk" },
  { prefix: "09-trust-ai", id: "trust-ai" },
  { prefix: "10-ai-chill", id: "ai-chill" },
];

export function cropForAsset(asset) {
  const { colW, heroH, shortY, shortH } = HYPE_GRID;
  const x = asset.col * colW;
  if (asset.row === "hero") return { x, y: 0, w: colW, h: heroH };
  return { x, y: shortY, w: colW, h: shortH };
}

export function buildCaptions(asset, origin = "https://synexus.pro") {
  const tags = "#SyNexus #Solana #Crypto #AI #ShouldIBuyThis #Shorts";
  const telegram = [
    `**${asset.headline}** · ${asset.tagline}`,
    "",
    asset.hook,
    "",
    asset.cta,
    "",
    `Scan free → ${origin}`,
    "",
    "Non-custodial · Not financial advice.",
  ].join("\n");

  const x = [asset.hook, "", asset.cta, origin, tags].join("\n");
  const xText = x.length <= 280 ? x : `${x.slice(0, 277)}…`;

  const tiktok = [asset.headline, asset.tagline, "", asset.hook, "", `${asset.cta} ${origin}`, "", tags].join("\n");

  return { telegram, x: xText, tiktok, facebook: tiktok, instagram: tiktok };
}

export function youtubeTitleFor(asset) {
  const titles = {
    "whale-alert": "This AI Found a Crypto Scam Before Anyone Else",
    "rise-above": "Would AI Have Stopped This Scam?",
    "level-up": "I Tested an AI Crypto Assistant for 30 Days",
    "ai-mode": "Can AI Actually Beat Human Traders?",
    "to-the-moon": "The Biggest Crypto Mistake Beginners Make",
    "ai-sees": "How Scammers Trick Thousands Every Day",
    "fast-moves": "This AI Found a Crypto Scam Before Anyone Else",
    "burn-risk": "Exit Liquidity Alert — Scan Before You Ape",
    "trust-ai": "Trust AI Not Hype · SyNexus Sentinel",
    "ai-chill": "AI Works While You Chill · SyNexus",
  };
  return titles[asset.id] || `${asset.headline} · SyNexus AI`;
}
