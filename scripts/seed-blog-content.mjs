#!/usr/bin/env node
/**
 * Seed SyNexus Journal with original SEO articles for AdSense review.
 * Run: node scripts/seed-blog-content.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BLOG_DIR = join(REPO_ROOT, "public", "blog");
const POSTS_DIR = join(BLOG_DIR, "posts");

const ORIGIN = "https://www.synexus.pro";
const TRUST_LINE = "Non-custodial · You sign every trade · Not financial advice.";
const AUTHOR = "SyNexus Editorial";

/** @type {Array<{ slug: string; title: string; excerpt: string; date: string; tags: string[]; sections: Array<{ h2: string; body: string }> }>} */
const ARTICLES = [
  {
    slug: "how-to-spot-crypto-scams-on-solana",
    title: "How to Spot Crypto Scams on Solana Before You Connect Your Wallet",
    excerpt:
      "Practical red flags every Solana trader should know — from fake mints to impersonator support accounts.",
    date: "2026-07-01",
    tags: ["scams", "Solana", "security", "beginners"],
    sections: [
      {
        h2: "Scams move at block speed",
        body: "On Solana, a malicious token can look legitimate for the first ten minutes: green candles, a slick website, and a Telegram full of hype. The difference between a fun trade and a drained wallet often comes down to what you check before you sign. SyNexus is built around that moment — paste a mint, read the Sentinel verdict, then decide in your own wallet.",
      },
      {
        h2: "Mint impersonation and name traps",
        body: "Scammers copy popular tickers and mint addresses with one character changed. Always verify the full mint address in a block explorer — not just the symbol on a chart. SyNexus Cipher lane flags naming traps and repeat scam motifs seen across prior launch seasons.",
      },
      {
        h2: "Fake support and approval drains",
        body: "No legitimate project asks for your seed phrase. Support accounts that DM you first on X or Telegram are almost always impersonators. Never approve unlimited token allowances to unknown sites. If someone promises to 'recover' lost funds, it is a second scam.",
      },
      {
        h2: "What SyNexus does — and does not do",
        body: "Sentinel scans surface liquidity risk, whale concentration, and pattern matches associated with rugs. That is research assistance, not a guarantee. You still verify contracts, check socials yourself, and size positions responsibly. Avoid means multiple lanes flagged harm; Watch means mixed signals; OK means lanes are within normal bounds for current data — none of these are buy recommendations.",
      },
    ],
  },
  {
    slug: "red-flags-before-you-buy-any-memecoin",
    title: "7 Red Flags to Check Before You Buy Any Memecoin",
    excerpt: "A repeatable checklist for Solana memecoin launches — liquidity, holders, authority, and social proof.",
    date: "2026-07-02",
    tags: ["memecoins", "risk", "checklist"],
    sections: [
      {
        h2: "Start with structure, not hype",
        body: "Charts lag reality. Before you chase a vertical candle, ask structural questions: Who holds supply? Is liquidity locked or removable? Are mint or freeze authorities still active? SyNexus compresses many of these reads into one paste-and-scan flow on the home feed.",
      },
      {
        h2: "Thin liquidity is not a flex",
        body: "A pool with very little SOL depth can move violently on small sells — and collapse when early wallets exit. Aegis lane watches liquidity integrity and sudden drains that often precede rugs.",
      },
      {
        h2: "Concentrated top wallets",
        body: "When a handful of wallets hold most supply, your buy may become someone else's exit liquidity. Leviathan lane tracks whale concentration and large-wallet flows so you see distribution into strength early.",
      },
      {
        h2: "Dead or copied socials",
        body: "Broken websites, recycled art, and bot-filled comment sections are common on fast launches. Community reports feed SyNexus scoring — operators flag suspicious tokens from token detail pages when signed in.",
      },
    ],
  },
  {
    slug: "fake-support-scams-and-wallet-drainers",
    title: "Fake Support Scams and Wallet Drainers: What Solana Traders Miss",
    excerpt: "How impersonators exploit urgency — and the habits that keep your keys safe.",
    date: "2026-07-03",
    tags: ["scams", "wallet", "security"],
    sections: [
      {
        h2: "The playbook never changes",
        body: "Urgency plus authority equals compromise. Fake 'SyNexus support,' fake Phantom help desks, and fake airdrop claim sites all push you to connect a wallet and sign a malicious transaction. Real support never asks for seed phrases or remote access to your device.",
      },
      {
        h2: "Drainer sites mimic real dApps",
        body: "Bookmark official URLs. Use wallet transaction previews and read what you are approving. Revoke suspicious token approvals periodically through your wallet's security tools.",
      },
      {
        h2: "If you think you were drained",
        body: "SyNexus cannot reverse blockchain transactions or recover seed phrases. Move remaining assets to a new wallet with a fresh seed phrase, document the incident, and report phishing URLs to your wallet provider and community channels.",
      },
    ],
  },
  {
    slug: "solana-wallet-security-basics",
    title: "Solana Wallet Security Basics Every Trader Should Know",
    excerpt: "Seed phrases, hardware wallets, device hygiene, and why non-custodial beats convenience hacks.",
    date: "2026-07-04",
    tags: ["wallet", "security", "Solana"],
    sections: [
      {
        h2: "Your keys, your responsibility",
        body: "SyNexus is non-custodial: we never hold SOL or tokens. Intelligence flows through the app; value stays in wallets you control. That means your security habits matter more than any score we display.",
      },
      {
        h2: "Seed phrase rules",
        body: "Write seed phrases offline. Never photograph them. Never store them in cloud notes or email. No support agent — including SyNexus — should ever ask for them.",
      },
      {
        h2: "Device and browser hygiene",
        body: "Keep wallet extensions updated. Use separate browser profiles for degen trading vs banking. Be skeptical of browser plugins that request broad permissions.",
      },
      {
        h2: "Hardware wallets for size",
        body: "For meaningful holdings, consider Ledger or similar hardware signing through Phantom or Solflare. The extra step beats rebuilding a portfolio from zero after a hot-wallet mistake.",
      },
    ],
  },
  {
    slug: "phantom-wallet-safety-checklist",
    title: "Phantom Wallet Safety Checklist for SyNexus Users",
    excerpt: "Step-by-step habits when connecting Phantom to scan, swap, and track Solana tokens.",
    date: "2026-07-05",
    tags: ["Phantom", "wallet", "checklist"],
    sections: [
      {
        h2: "Connect only on sites you trust",
        body: "Use https://www.synexus.pro and verify the URL bar. SyNexus opens swap shortcuts; Phantom handles signing. If a popup appears on an unfamiliar domain, reject it.",
      },
      {
        h2: "Review every transaction",
        body: "Read token names, amounts, and program IDs in Phantom's preview. Malicious approvals often hide behind generic labels.",
      },
      {
        h2: "Separate wallets for experiments",
        body: "Many operators keep a 'burner' wallet for new mints and a separate cold or hardware-backed wallet for long-term holdings. Losses on the burner stay contained.",
      },
    ],
  },
  {
    slug: "understanding-solana-mint-addresses",
    title: "Understanding Solana Mint Addresses (And Why Copy-Paste Errors Cost Money)",
    excerpt: "What a mint is, how to verify it, and how SyNexus uses mints in Should I buy this?",
    date: "2026-07-06",
    tags: ["Solana", "research", "beginners"],
    sections: [
      {
        h2: "Mint vs ticker",
        body: "BONK is a symbol; the mint address is the unique on-chain identifier. Two tokens can share similar names — only the mint is authoritative.",
      },
      {
        h2: "Where to verify",
        body: "Cross-check mints on Solscan or Solana Explorer before swapping. SyNexus accepts symbols for convenience but always resolves to a mint for scanning.",
      },
      {
        h2: "Shareable scan links",
        body: "When you scan a token on SyNexus, you can share the URL so friends see the same Sentinel read. That helps groups align on the same contract — not the same ticker on a random chart.",
      },
    ],
  },
  {
    slug: "liquidity-pools-explained-for-beginners",
    title: "Liquidity Pools Explained for Beginners on Solana",
    excerpt: "Why depth matters, how pools can be pulled, and what Sentinels watch on new launches.",
    date: "2026-07-07",
    tags: ["liquidity", "DeFi", "beginners"],
    sections: [
      {
        h2: "Pools enable swaps",
        body: "DEX pools pair your token with SOL (or stables). Depth determines how much you can buy or sell without extreme slippage — and how hard it is for insiders to exit.",
      },
      {
        h2: "Liquidity removal risk",
        body: "If creators retain keys to remove liquidity, they can drain the pool after retail buys. Aegis lane incorporates liquidity integrity signals into Avoid and Watch verdicts.",
      },
      {
        h2: "Read before you ape",
        body: "A hot chart with a shallow pool is a classic trap. Scan first on SyNexus, then connect your wallet only when you accept the structural risk.",
      },
    ],
  },
  {
    slug: "what-is-a-rug-pull-on-solana",
    title: "What Is a Rug Pull on Solana? Patterns SyNexus Aegis Flags Early",
    excerpt: "From liquidity pulls to slow bleeds — how rugs show up in on-chain data before timelines explode.",
    date: "2026-07-08",
    tags: ["rug pull", "scams", "Aegis"],
    sections: [
      {
        h2: "Not every dump is a rug",
        body: "Volatility is normal. Rugs are structural: liquidity removed, mint authority abused, or coordinated insider exits into thin books. Sentinels distinguish panic from predation when data supports it.",
      },
      {
        h2: "Common rug tells",
        body: "Sudden LP drain, extreme top-holder percentage, inactive or fake socials, and repeat deployer wallets associated with prior losses. Community reports accelerate detection across the network.",
      },
      {
        h2: "No tool catches everything",
        body: "SyNexus reduces noise — it does not eliminate risk. Use verdicts as one input in your process, not the whole process.",
      },
    ],
  },
  {
    slug: "whale-wallets-and-exit-liquidity",
    title: "Whale Wallets and Exit Liquidity: Reading Leviathan Lane",
    excerpt: "Why your green candle might fund someone else's exit — and how to scan holder concentration first.",
    date: "2026-07-09",
    tags: ["whales", "Leviathan", "trading"],
    sections: [
      {
        h2: "Exit liquidity defined",
        body: "Retail buys often provide the liquidity insiders need to sell into strength. Leviathan lane surfaces whale concentration and large-wallet movements so you see distribution early.",
      },
      {
        h2: "Holder charts lie slowly",
        body: "By the time social feeds scream, on-chain concentration may already be extreme. Paste the mint in Should I buy this? before you FOMO.",
      },
      {
        h2: "Combine lanes",
        body: "Whale data alone is not a verdict. Pulse momentum, Aegis security, and Cipher patterns fuse into one plain-English read on SyNexus.",
      },
    ],
  },
  {
    slug: "how-synexus-sentinel-scoring-works",
    title: "How SyNexus Sentinel Scoring Works: Four Lanes, One Verdict",
    excerpt: "Aegis, Pulse, Leviathan, and Cipher — what each lane measures and how scores become Avoid, Watch, or OK.",
    date: "2026-07-10",
    tags: ["Sentinel", "SyNexus", "methodology"],
    sections: [
      {
        h2: "Parallel scans, fused read",
        body: "Instead of drowning you in dashboards, SyNexus runs four Sentinel lanes in parallel and fuses them into one risk band and score with human-readable reasons.",
      },
      {
        h2: "Lane responsibilities",
        body: "Aegis covers security and privacy — scams, rugs, contracts, liquidity. Pulse tracks volume and momentum integrity. Leviathan watches whales. Cipher matches naming traps and swarm reports.",
      },
      {
        h2: "Informational only",
        body: "Scores use heuristics and third-party APIs. They can be wrong or delayed. Always verify mint addresses and do your own research before trading.",
      },
    ],
  },
  {
    slug: "token-research-guide-should-i-buy-this",
    title: "Token Research Guide: How to Use Should I Buy This?",
    excerpt: "A step-by-step walkthrough of SyNexus's fastest research tool — paste, scan, read, share.",
    date: "2026-07-11",
    tags: ["research", "tutorial", "SyNexus"],
    sections: [
      {
        h2: "One question, one workflow",
        body: "Open the home feed, paste a Solana symbol or mint into Should I buy this?, and tap scan. You get Avoid, Watch, or OK in plain English plus supporting signals.",
      },
      {
        h2: "Three free deep scans",
        body: "New visitors get three deep scans before signup. Re-scanning the same token does not consume another slot — compare reads over time as conditions change.",
      },
      {
        h2: "Use the tutorial",
        body: "Tap the small ? button on the scan panel for a watch-and-listen tutorial that explains what the tool does and what it never will do.",
      },
      {
        h2: "Share your read",
        body: "Send the scan URL to friends so everyone references the same mint and Sentinel fusion — critical during fast memecoin cycles.",
      },
    ],
  },
  {
    slug: "ai-trading-assistants-what-they-can-and-cannot-do",
    title: "AI Trading Assistants: What They Can and Cannot Do for Crypto",
    excerpt: "Separate hype from utility — research synthesis, risk explanation, and hard limits of AI on volatile markets.",
    date: "2026-07-12",
    tags: ["AI", "Titan", "education"],
    sections: [
      {
        h2: "Good at compression",
        body: "AI excels at summarizing token metadata, explaining Sentinel reads, and answering 'what does Watch mean here?' in plain language. Titan on SyNexus is built for that operator loop.",
      },
      {
        h2: "Bad at prophecy",
        body: "No model knows tomorrow's price. AI can hallucinate, lag live data, or miss novel scam structures. Treat outputs as drafts for your judgment — not orders.",
      },
      {
        h2: "SyNexus triad behind the scenes",
        body: "Server-side orchestration improves draft quality before you see Titan's reply. That does not make responses infallible — verify on-chain facts yourself.",
      },
    ],
  },
  {
    slug: "using-titan-ai-for-crypto-research",
    title: "Using Titan AI for Crypto Research Without Over-Trusting It",
    excerpt: "Prompt patterns, Sentinel context, and when to stop chatting and open a block explorer.",
    date: "2026-07-13",
    tags: ["Titan", "AI", "research"],
    sections: [
      {
        h2: "Ask specific questions",
        body: "Instead of 'moon?', ask 'why did this token flag Watch on Aegis?' or 'explain whale concentration on this mint.' Specific prompts get useful, auditable answers.",
      },
      {
        h2: "Rename Titan if you want",
        body: "Titan is the default commander persona — you can rename it in settings. The four Sentinels keep fixed names for consistent lane reporting.",
      },
      {
        h2: "Voice and accessibility",
        body: "Titan supports read-aloud briefings on supported devices. Pair voice summaries with the written scan so you do not trade on audio alone in noisy markets.",
      },
    ],
  },
  {
    slug: "avoid-watch-ok-verdicts-explained",
    title: "Avoid, Watch, OK: What SyNexus Verdicts Really Mean",
    excerpt: "Plain-English definitions — and common misconceptions that get traders rekt.",
    date: "2026-07-14",
    tags: ["Sentinel", "verdicts", "beginners"],
    sections: [
      {
        h2: "Avoid",
        body: "Multiple lanes flag elevated harm: thin liquidity, dangerous concentration, or pattern matches tied to prior rugs. Avoid is not a personal insult to the token — it is a structured harm read for the current dataset.",
      },
      {
        h2: "Watch",
        body: "Mixed signals worth monitoring before you connect a wallet. Many legitimate early tokens land here. Size down, verify mints, and re-scan as data refreshes.",
      },
      {
        h2: "OK",
        body: "Lanes are within normal bounds for available data. OK is not a buy signal — it means fewer structural red flags surfaced in this pass. Markets move; re-scan when volatility spikes.",
      },
    ],
  },
  {
    slug: "solana-momentum-trading-risks",
    title: "Solana Momentum Trading Risks Pulse Lane Surfaces",
    excerpt: "Volume spikes, fake velocity, and why momentum without liquidity support is fragile.",
    date: "2026-07-15",
    tags: ["Pulse", "trading", "momentum"],
    sections: [
      {
        h2: "Momentum is not proof",
        body: "Green candles attract attention. Pulse lane checks whether volume and volatility look organic or manufactured — wash patterns and bot bursts show up in lane metadata.",
      },
      {
        h2: "Fast markets need fast reads",
        body: "SyNexusPro subscribers get faster Sentinel refresh for operators who paste dozens of tokens per session. Free tier still covers core scans for casual research.",
      },
    ],
  },
  {
    slug: "weekly-solana-market-outlook-july-2026",
    title: "Weekly Solana Market Outlook — July 2026",
    excerpt: "Macro context, memecoin season rhythms, and how to use Sentinel reads in choppy weeks.",
    date: "2026-07-16",
    tags: ["market analysis", "Solana", "weekly"],
    sections: [
      {
        h2: "Environment scan",
        body: "Solana activity remains dominated by launch velocity and short holding periods. That rewards operators who scan before they sign — not after CT discovers the ticker.",
      },
      {
        h2: "Risk posture this week",
        body: "When launch density rises, impersonation scams and liquidity traps rise with it. Tighten position sizing, favor mint verification, and treat Watch verdicts as pause buttons — not invitations.",
      },
      {
        h2: "How we write these outlooks",
        body: "SyNexus weekly notes are educational framing — not price targets or trade signals. Pair them with your own chart work and on-chain verification.",
      },
    ],
  },
  {
    slug: "memecoin-season-survival-guide",
    title: "Memecoin Season Survival Guide for Solana Traders",
    excerpt: "Position sizing, scan discipline, and emotional traps during high-velocity launch weeks.",
    date: "2026-07-17",
    tags: ["memecoins", "trading", "psychology"],
    sections: [
      {
        h2: "Rules beat vibes",
        body: "Define max loss per trade before you open Phantom. If a token is Avoid on SyNexus and you cannot articulate why you are ignoring that, skip it.",
      },
      {
        h2: "Re-scan the same mint",
        body: "Conditions change in minutes. Re-scanning the same token does not burn another free deep scan slot — use that to track deteriorating liquidity or whale exits.",
      },
      {
        h2: "Take breaks",
        body: "Fatigue causes mis-clicks and sloppy approvals. The chain does not undo mistakes because you were tired.",
      },
    ],
  },
  {
    slug: "dex-scanner-vs-sentinel-read",
    title: "DEX Scanners vs SyNexus Sentinel Reads: What's Different?",
    excerpt: "Charts show price; Sentinels show structure — why both matter and neither is enough alone.",
    date: "2026-07-18",
    tags: ["research", "SyNexus", "comparison"],
    sections: [
      {
        h2: "Charts are lagging",
        body: "Price and volume charts describe what already happened. Sentinel lanes emphasize forward risk: who holds supply, pool health, and scam pattern matches.",
      },
      {
        h2: "One coherent verdict",
        body: "SyNexus fuses lanes into Avoid, Watch, or OK with reasons — less tab hopping during fast decisions.",
      },
      {
        h2: "Use both",
        body: "Many operators chart on DexScreener or Birdeye and scan on SyNexus before signing. Complementary tools beat any single dashboard.",
      },
    ],
  },
  {
    slug: "community-reports-crowd-intelligence",
    title: "Community Reports and Crowd Intelligence on SyNexus",
    excerpt: "How operator reports improve Sentinel awareness — without replacing your own verification.",
    date: "2026-07-19",
    tags: ["community", "Sentinel", "reports"],
    sections: [
      {
        h2: "Operators see scams first",
        body: "Signed-in users can report suspicious tokens from detail pages. Reports feed Cipher and broader scoring so repeat motifs surface faster for everyone.",
      },
      {
        h2: "Reports are not verdicts",
        body: "Crowd flags can be wrong or malicious. SyNexus weighs reports alongside on-chain heuristics — never treat a report count as proof by itself.",
      },
    ],
  },
  {
    slug: "synexus-pro-features-deep-dive",
    title: "SyNexusPro Features Deep Dive: Who Benefits and Why",
    excerpt: "Oracle briefings, faster refresh, fee tiers, and the seven-day trial explained honestly.",
    date: "2026-07-20",
    tags: ["SyNexusPro", "pricing", "features"],
    sections: [
      {
        h2: "Built for daily operators",
        body: "If you paste more than a few tokens per week, Pro's faster Sentinel refresh and deeper grid on Pulse save real time — and one Avoid verdict can pay for a month.",
      },
      {
        h2: "Fee tier difference",
        body: "Pro reduces swap fees versus free tier when using SyNexus trade shortcuts. Exact tiers are shown in-app before you sign.",
      },
      {
        h2: "Trial and cancellation",
        body: "New signups get a seven-day Pro trial with card on file at checkout. Cancel through billing tools linked from Pulse; see Refund Policy for eligibility details.",
      },
    ],
  },
  {
    slug: "non-custodial-trading-why-it-matters",
    title: "Non-Custodial Trading: Why SyNexus Never Holds Your Keys",
    excerpt: "Custody models, swap routing, and what operators should expect from a research-first app.",
    date: "2026-07-21",
    tags: ["non-custodial", "trust", "SyNexus"],
    sections: [
      {
        h2: "Intelligence layer, not exchange",
        body: "SyNexus organizes data, Sentinel heuristics, and Jupiter shortcuts. You sign every swap in Phantom, Solflare, or Backpack — we cannot move your funds.",
      },
      {
        h2: "Why that matters for ads and trust",
        body: "Regulators and users alike scrutinize custody. Our model keeps asset control with you while we compete on speed and clarity of risk reads.",
      },
    ],
  },
  {
    slug: "solana-smart-contract-risks-for-traders",
    title: "Smart Contract Risks on Solana Every Trader Should Understand",
    excerpt: "Token programs, authorities, and upgradeability — without needing to be a developer.",
    date: "2026-07-22",
    tags: ["contracts", "security", "Solana"],
    sections: [
      {
        h2: "Authorities are power",
        body: "Mint and freeze authorities let issuers create supply or freeze accounts. Renounced authority reduces certain risks but does not make a token 'safe' by itself.",
      },
      {
        h2: "Verify in explorers",
        body: "Check token program details on Solscan before large entries. Aegis incorporates authority and metadata signals into scans where data is available.",
      },
    ],
  },
  {
    slug: "how-to-verify-a-token-before-swapping",
    title: "How to Verify a Token Before Swapping on Jupiter or Any DEX",
    excerpt: "A five-minute verification ritual that pairs perfectly with a SyNexus scan.",
    date: "2026-07-23",
    tags: ["research", "checklist", "swaps"],
    sections: [
      {
        h2: "Minute one: mint",
        body: "Copy the full mint from SyNexus or the project's official channel — not a reposted screenshot.",
      },
      {
        h2: "Minute two: scan",
        body: "Run Should I buy this? on SyNexus. Read Avoid, Watch, or OK and the listed reasons.",
      },
      {
        h2: "Minute three: explorer",
        body: "Open Solscan. Confirm holder distribution and recent large transfers.",
      },
      {
        h2: "Minute four: social proof",
        body: "Find official links from verified project accounts — beware lookalike domains.",
      },
      {
        h2: "Minute five: size",
        body: "If you still trade, size for total loss. Verification reduces mistakes; it does not remove them.",
      },
    ],
  },
  {
    slug: "2026-06-28-should-i-buy-this-methodology",
    title: "Should I Buy This? The SyNexus Methodology",
    excerpt: "Plain English token intelligence for Solana — built for speed, not hype.",
    date: "2026-06-28",
    tags: ["SyNexus", "methodology", "Sentinel"],
    sections: [
      {
        h2: "Built for decision speed",
        body: "Memecoin cycles move in minutes. SyNexus compresses hours of manual chart and wallet research into seconds — one paste, one Sentinel fusion, one verdict.",
      },
      {
        h2: "Four Sentinel lanes",
        body: "Aegis hunts rug and liquidity traps. Pulse reads momentum integrity. Leviathan shadows whale wallets. Cipher fuses weak cross-lane signals and community reports.",
      },
      {
        h2: "Pro when you need depth",
        body: "Free tier covers the core scan. SyNexusPro unlocks full Sentinel grid refresh, Oracle briefings, and reduced trading fees — for operators who live on-chain daily.",
      },
    ],
  },
];

function buildPost(article) {
  const blocks = article.sections.flatMap((s) => [
    { type: "h2", text: s.h2 },
    { type: "p", text: s.body },
  ]);

  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    date: article.date,
    author: AUTHOR,
    origin: ORIGIN,
    trustLine: TRUST_LINE,
    blocks,
    cta: `Run a free Sentinel scan → ${ORIGIN}`,
    tags: article.tags,
  };
}

async function main() {
  await mkdir(POSTS_DIR, { recursive: true });

  const index = ARTICLES.map((article) => {
    const post = buildPost(article);
    return {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      date: post.date,
      tags: post.tags,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  for (const article of ARTICLES) {
    const post = buildPost(article);
    const path = join(POSTS_DIR, `${post.slug}.json`);
    await writeFile(path, JSON.stringify(post, null, 2), "utf8");
  }

  await writeFile(join(BLOG_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");

  const sitemapUrls = [
    "",
    "/about",
    "/trust",
    "/contact",
    "/faq",
    "/blog",
    "/terms",
    "/privacy",
    "/disclaimer",
    "/refund-policy",
    "/pricing",
    ...index.map((p) => `/blog/${p.slug}`),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (path) => `  <url>
    <loc>${ORIGIN}${path}</loc>
    <changefreq>${path.startsWith("/blog/") ? "monthly" : "weekly"}</changefreq>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  await writeFile(join(REPO_ROOT, "public", "sitemap.xml"), sitemap, "utf8");
  await writeFile(
    join(REPO_ROOT, "public", "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`,
    "utf8",
  );

  console.log(`✓ Seeded ${ARTICLES.length} articles to public/blog/`);
  console.log(`✓ Wrote sitemap.xml and robots.txt`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
