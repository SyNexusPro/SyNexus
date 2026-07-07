#!/usr/bin/env node
/**
 * Synexus Growth Loop — self-funding engine (6-month reinvest-only phase).
 *
 *   npm run growth:status   Treasury + phase + what to run
 *   npm run growth:once     Today: blog → Telegram teaser → video blast
 *   npm run growth:watch    Daily blog at 6am + 3× blast watch
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { parseArgs } from "./videoUtils.js";
import { generateDailyBlog, buildBlogTelegramTeaser } from "./blogGenerator.js";
import { ensureGrowthPhase, printTreasuryReport, readPotState } from "./treasuryPot.js";
import { runDueBlast } from "./dailyBlastPost.js";
import { hasTelegramConfig, postTelegram } from "./platforms/telegram.js";
import { currentLaunchDayIndex } from "./viralLaunchPlan.js";
import { appOrigin } from "./marketingCopy.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, "output", "growth", "growth-state.json");

const SIX_MONTH_PHASES = [
  { month: 1, focus: "Launch · Telegram · daily blog SEO", actions: ["launch:render", "blast:watch", "blog:generate"] },
  { month: 2, focus: "Pro conversion · Sentinel authority content", actions: ["Pro CTAs in every post", "Stripe audit weekly"] },
  { month: 3, focus: "Referrals · affiliate hooks · winner remix", actions: ["launch:winner", "referral blurbs in app"] },
  { month: 4, focus: "Scale top formats · Discord + YouTube", actions: ["Finish YT/TikTok auth", "Double down on winners"] },
  { month: 5, focus: "Treasury compounds · compliance reserve", actions: ["treasury:log all revenue", "Legal/audit bucket"] },
  { month: 6, focus: "Review metrics · optional operator draw", actions: ["Hit MRR target", "Decide reinvest vs withdraw"] },
];

async function readGrowthState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return { blogs: [], lastBlogDate: null, blogCount: 0, runs: [] };
  }
}

async function writeGrowthState(state) {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentPhaseMonth(startedAt) {
  if (!startedAt) return 1;
  const start = new Date(startedAt);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
  return Math.min(6, Math.max(1, months));
}

export async function runDailyBlogCycle({ force = false, quiet = false } = {}) {
  const state = await readGrowthState();
  const today = todayKey();

  if (state.lastBlogDate === today && !force) {
    if (!quiet) console.log("↷ Blog already published today");
    return { skipped: true, state };
  }

  const { post, slug } = await generateDailyBlog();
  state.lastBlogDate = today;
  state.blogCount = (state.blogCount || 0) + 1;
  state.blogs = [{ slug, title: post.title, date: post.date }, ...(state.blogs || [])].slice(0, 30);

  if (hasTelegramConfig()) {
    try {
      await postTelegram(buildBlogTelegramTeaser(post), { quiet });
      state.lastBlogTelegram = new Date().toISOString();
    } catch (err) {
      if (!quiet) console.warn("Telegram blog teaser:", err.message);
    }
  } else if (!quiet) {
    console.log("↷ Telegram not configured — blog live on site only");
  }

  await writeGrowthState(state);
  if (!quiet) {
    console.log(`✓ Blog: ${post.title}`);
    console.log(`  ${appOrigin()}/blog/${slug}`);
  }
  return { skipped: false, post, slug, state };
}

export async function runGrowthOnce({ force = false } = {}) {
  const { policy, state: potState } = await ensureGrowthPhase();
  const phaseMonth = currentPhaseMonth(potState.startedAt);
  const phase = SIX_MONTH_PHASES[phaseMonth - 1];

  console.log("\n🌱 SYNEXUS GROWTH LOOP — once");
  console.log(`Phase month ${phaseMonth}/6: ${phase.focus}`);
  console.log(`Launch day: ${currentLaunchDayIndex()}/7\n`);

  await runDailyBlogCycle({ force, quiet: false });
  console.log("\n📣 Running due video blast slots…");
  await runDueBlast({ force, quiet: false });

  const growthState = await readGrowthState();
  growthState.runs = [{ at: new Date().toISOString(), phase: phaseMonth }, ...(growthState.runs || [])].slice(0, 60);
  await writeGrowthState(growthState);

  console.log("\n✓ Growth cycle complete. Log Stripe revenue:");
  console.log("  npm run treasury:log -- --source=pro_subs --amount=9.99\n");
}

export async function printGrowthStatus() {
  const { policy, state: potState } = await ensureGrowthPhase();
  const growthState = await readGrowthState();
  const phaseMonth = currentPhaseMonth(potState.startedAt);
  const phase = SIX_MONTH_PHASES[phaseMonth - 1];

  await printTreasuryReport();

  console.log("GROWTH ENGINE");
  console.log("═".repeat(52));
  console.log(`Phase: Month ${phaseMonth}/6 — ${phase.focus}`);
  console.log(`Blogs published: ${growthState.blogCount || 0} (target ${policy.sixMonthTargets.blogPosts})`);
  console.log(`Last blog: ${growthState.lastBlogDate ?? "none yet"}`);
  console.log(`App: ${appOrigin()}`);
  console.log("\nThis month's actions:");
  for (const a of phase.actions) console.log(`  · ${a}`);
  console.log("\nRun the engine:");
  console.log("  npm run growth:once      # blog + blast now");
  console.log("  npm run growth:watch     # autonomous daily + 3× blast");
  console.log("  npm run launch:watch     # 7-day launch mode");
  console.log("");
}

function msUntilHour(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function runWatch({ force = false } = {}) {
  console.log("\n🌱 SYNEXUS GROWTH WATCH — reinvest-only mode");
  console.log("  06:00 — new blog + Telegram teaser");
  console.log("  09/14/20 — video blast (Telegram · X · …)\n");

  const blogTick = async (label) => {
    console.log(`\n[${label}] Blog cycle…`);
    try {
      await runDailyBlogCycle({ force, quiet: false });
    } catch (err) {
      console.error("[blog]", err.message || err);
    }
  };

  await blogTick("Startup");
  setInterval(() => blogTick("06:00 daily"), msUntilHour(6));

  const blastTick = async (label) => {
    console.log(`\n[${label}] Blast…`);
    try {
      await runDueBlast({ force, quiet: false });
    } catch (err) {
      console.error("[blast]", err.message || err);
    }
  };

  await blastTick("Startup blast");
  const { msUntilNextSlot } = await import("./scheduleUtils.js");
  const scheduleBlast = () => {
    const wait = msUntilNextSlot();
    setTimeout(async () => {
      await blastTick("Scheduled");
      scheduleBlast();
    }, wait);
  };
  scheduleBlast();
}

async function main() {
  const args = process.argv.slice(2);
  const { force, watch, help } = parseArgs(args);

  if (help || args.includes("--status")) {
    await printGrowthStatus();
    return;
  }

  if (watch) {
    await runWatch({ force });
    return;
  }

  if (args.includes("--blog-only")) {
    await runDailyBlogCycle({ force, quiet: false });
    return;
  }

  await runGrowthOnce({ force });
}

const isMain =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) || process.argv[1].endsWith("growthLoop.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

export { SIX_MONTH_PHASES };
