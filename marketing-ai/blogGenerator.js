#!/usr/bin/env node
/**
 * Synexus SEO blog — trust-building articles, auto-published to public/blog/.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { TRUST_LINE, appOrigin } from "./marketingCopy.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PUBLIC_BLOG = join(REPO_ROOT, "public", "blog");
const OUTPUT_BLOG = join(__dirname, "output", "blog");

const TOPICS = [
  {
    slug: "sentinel-risk-read-explained",
    title: "How the Synexus Sentinel Risk Read Works",
    excerpt: "What Avoid, Watch, and OK actually mean — and what Synexus does not do.",
    sections: [
      {
        h2: "One question, one answer",
        body: "Synexus is built around a single operator question: should I buy this? Paste a Solana mint or symbol. The Sentinel engine fuses liquidity health, whale concentration, momentum drift, and rug-pattern heuristics into one plain-English verdict.",
      },
      {
        h2: "Avoid · Watch · OK",
        body: "Avoid means multiple lanes flag elevated harm — thin liquidity, dangerous wallet concentration, or pattern matches associated with prior rugs. Watch means mixed signals: something worth monitoring before you connect a wallet. OK means lanes are within normal bounds for the current data — not a buy recommendation, only a cleaner read.",
      },
      {
        h2: "Non-custodial by design",
        body: "Synexus never holds your SOL or tokens. We do not execute trades. You sign every swap in your own wallet. The read is informational — always verify the mint address and do your own research.",
      },
    ],
  },
  {
    slug: "exit-liquidity-solana",
    title: "Exit Liquidity on Solana: What Sentinels Watch For",
    excerpt: "Why charts lie last — and what to scan before you ape.",
    sections: [
      {
        h2: "The chart is the bait",
        body: "Retail often sees green candles. Sentinels see who holds supply, how deep the pool is, and whether early wallets are distributing into strength. Exit liquidity is when your buy becomes someone else's exit.",
      },
      {
        h2: "Signals Synexus tracks",
        body: "Top-wallet percentage, sudden liquidity drains, velocity without volume support, and repeat scam motifs across launch seasons. Synexus surfaces these before you sign — not after the timeline screams.",
      },
      {
        h2: "Use the read, keep control",
        body: "A Watch or Avoid verdict is not fear-mongering. It is structured data so you decide with eyes open. Free scans at synexus.pro.",
      },
    ],
  },
  {
    slug: "should-i-buy-this-methodology",
    title: "Should I Buy This? The Synexus Methodology",
    excerpt: "Plain English token intelligence for Solana — built for speed, not hype.",
    sections: [
      {
        h2: "Built for decision speed",
        body: "Memecoin cycles move in minutes. Synexus compresses hours of manual chart and wallet research into seconds — one paste, one Sentinel fusion, one verdict.",
      },
      {
        h2: "Four Sentinel lanes",
        body: "Aegis hunts rug and liquidity traps. Pulse reads momentum integrity. Titan shadows whale wallets. Cipher fuses weak cross-lane signals. Oracle Supreme is the strategic layer on Pro.",
      },
      {
        h2: "Pro when you need depth",
        body: "Free tier covers the core scan. Synexus Pro unlocks full Sentinel grid refresh, Oracle briefings, and reduced trading fees — for operators who live on-chain daily.",
      },
    ],
  },
  {
    slug: "synexus-pro-worth-it",
    title: "When Synexus Pro Pays for Itself",
    excerpt: "Who Pro is for — and how fee savings compound.",
    sections: [
      {
        h2: "Who Pro is for",
        body: "Active Solana traders who paste more than a few tokens per week. If one Avoid verdict saves a bad entry, Pro has already earned its keep.",
      },
      {
        h2: "What changes on Pro",
        body: "Faster Sentinel refresh, Oracle Supreme voice briefings, full operator grid on Pulse, and 0.05% swap fees vs 0.10% on free tier.",
      },
      {
        h2: "Cancel anytime",
        body: "Pro is $19.99/month through Stripe. No lock-in. You control your subscription from checkout.",
      },
    ],
  },
  {
    slug: "rug-pull-patterns-2026",
    title: "Solana Rug Patterns That Repeat Every Season",
    excerpt: "Synexus pattern library — what Aegis flags before mints blow up.",
    sections: [
      {
        h2: "The launch playbook",
        body: "New mint, synthetic volume, influencer push, liquidity looks fine for twenty minutes — then concentration reveals the exit. Synexus pattern scans catch structural tells early.",
      },
      {
        h2: "What to do",
        body: "Paste before you connect Phantom. Read Avoid or Watch. Check the mint on-chain yourself. Never share seed phrases with anyone claiming to be Synexus support.",
      },
      {
        h2: "Community layer",
        body: "Report suspicious tokens in-app. Sentinels learn from operator reports across the network.",
      },
    ],
  },
];

function todaySlug() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pickTopic(dayIndex) {
  return TOPICS[dayIndex % TOPICS.length];
}

export function buildBlogPost(topic, date = new Date()) {
  const origin = appOrigin();
  const dateIso = date.toISOString().slice(0, 10);
  const slug = `${todaySlug()}-${topic.slug}`;

  const paragraphs = topic.sections.flatMap((s) => [
    { type: "h2", text: s.h2 },
    { type: "p", text: s.body },
  ]);

  return {
    slug,
    title: topic.title,
    excerpt: topic.excerpt,
    date: dateIso,
    author: "Synexus Sentinel",
    origin,
    trustLine: TRUST_LINE,
    blocks: paragraphs,
    cta: `Run a free Sentinel scan → ${origin}`,
    tags: ["Synexus", "Solana", "Sentinel", "crypto", "risk"],
  };
}

export async function publishBlogPost(post) {
  await mkdir(join(PUBLIC_BLOG, "posts"), { recursive: true });
  await mkdir(OUTPUT_BLOG, { recursive: true });

  const postPath = join(PUBLIC_BLOG, "posts", `${post.slug}.json`);
  const outPath = join(OUTPUT_BLOG, `${post.slug}.json`);
  const body = JSON.stringify(post, null, 2);

  await writeFile(postPath, body, "utf8");
  await writeFile(outPath, body, "utf8");

  let index = [];
  try {
    index = JSON.parse(await readFile(join(PUBLIC_BLOG, "index.json"), "utf8"));
  } catch {
    index = [];
  }

  index = index.filter((p) => p.slug !== post.slug);
  index.unshift({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    date: post.date,
  });
  index = index.slice(0, 120);

  await writeFile(join(PUBLIC_BLOG, "index.json"), JSON.stringify(index, null, 2), "utf8");

  const md = [
    `# ${post.title}`,
    `*${post.date} · ${post.author}*`,
    "",
    post.excerpt,
    "",
    ...post.blocks.flatMap((b) => (b.type === "h2" ? [`## ${b.text}`, ""] : [b.text, ""])),
    "",
    post.cta,
    "",
    post.trustLine,
  ].join("\n");

  await writeFile(join(OUTPUT_BLOG, `${post.slug}.md`), md, "utf8");

  return { postPath, slug: post.slug };
}

export async function generateDailyBlog({ dayOffset = 0 } = {}) {
  const dayIndex = Math.floor(Date.now() / 86_400_000) + dayOffset;
  const topic = pickTopic(dayIndex);
  const post = buildBlogPost(topic);
  const published = await publishBlogPost(post);
  return { post, ...published };
}

export function buildBlogTelegramTeaser(post) {
  return [
    `**Synexus Journal** · ${post.title}`,
    "",
    post.excerpt,
    "",
    `Read → ${appOrigin()}/blog/${post.slug}`,
    "",
    TRUST_LINE,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(`Synexus blog generator

  npm run blog:generate     Publish today's article to public/blog/
  node blogGenerator.js --list
`);
    return;
  }

  if (args.includes("--list")) {
    TOPICS.forEach((t, i) => console.log(`${i + 1}. ${t.title}`));
    return;
  }

  const { slug, postPath, post } = await generateDailyBlog();
  console.log(`\n✓ Blog published: ${post.title}`);
  console.log(`  ${postPath}`);
  console.log(`  Live: ${appOrigin()}/blog/${slug}`);
}

const isMain =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
    process.argv[1].endsWith("blogGenerator.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
