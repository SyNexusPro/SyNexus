#!/usr/bin/env node
/**
 * Synexus 7-Day Viral Launch — content automation
 *
 *   npm run launch:plan              # print 7-day plan
 *   npm run launch:write -- --day 1    # export scripts + captions
 *   npm run launch:render -- --day 1   # render all videos for a day
 *   npm run launch:day -- --day 1        # write + render + blast slot
 *   npm run launch:watch               # auto-run current launch day
 *   npm run launch:winner -- --id d5-s3  # mark winner for Day 6 remix
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadMarketingEnv } from "./loadEnv.js";
import {
  LAUNCH_DAYS,
  LAUNCH_GOAL,
  VIRAL_RULES,
  getLaunchDay,
  currentLaunchDayIndex,
  postStructureReminder,
} from "./viralLaunchPlan.js";
import { getScriptsForDay, totalScriptCount, allLaunchScripts } from "./viralLaunchScripts.js";
import { launchDayPath, readLaunchState, writeLaunchState, recordWinner, getWinnersForDay6 } from "./launchState.js";
import { renderLaunchDay } from "./viralLaunchRender.js";
import { runBlastSlot } from "./dailyBlastPost.js";
import { parseArgs } from "./videoUtils.js";

loadMarketingEnv();

function printPlan() {
  console.log("\n🚀 SYNEXUS 7-DAY VIRAL LAUNCH PLAN\n");
  console.log("Goal:", LAUNCH_GOAL.videosTotal);
  console.log("Home base:", LAUNCH_GOAL.homeBase);
  console.log("Total scripted videos:", totalScriptCount());
  console.log("\nViral rules:");
  for (const r of VIRAL_RULES) console.log(`  · ${r}`);
  console.log("\nPost structure:", postStructureReminder());
  console.log("");

  for (const day of LAUNCH_DAYS) {
    console.log(`${day.emoji} DAY ${day.day} — ${day.title}`);
    console.log(`   Objective: ${day.objective}`);
    console.log(`   Videos: ${day.videoTarget.min}–${day.videoTarget.max}`);
    console.log(`   Telegram: ${day.telegramAction}`);
    if (day.kpi) console.log(`   KPI: ${day.kpi}`);
    console.log("");
  }
}

async function resolveScripts(dayNumber) {
  const state = await readLaunchState();
  const winners = await getWinnersForDay6(allLaunchScripts());
  return getScriptsForDay(dayNumber, winners);
}

async function writeDayPack(dayNumber) {
  const plan = getLaunchDay(dayNumber);
  const scripts = await resolveScripts(dayNumber);
  const dir = launchDayPath(dayNumber);
  await mkdir(dir, { recursive: true });

  const manifest = {
    day: dayNumber,
    title: plan.title,
    objective: plan.objective,
    telegramAction: plan.telegramAction,
    scriptCount: scripts.length,
    scripts: scripts.map((s) => ({ id: s.id, hook: s.hook, format: s.format })),
    generatedAt: new Date().toISOString(),
  };

  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(join(dir, "telegram-launch.txt"), plan.telegramAction, "utf8");

  for (const script of scripts) {
    await writeFile(
      join(dir, `${script.id}.json`),
      JSON.stringify(script, null, 2),
      "utf8",
    );
    await writeFile(join(dir, `${script.id}-script.txt`), formatScriptForCapCut(script), "utf8");
    await writeFile(join(dir, `${script.id}-telegram.txt`), script.telegramCaption, "utf8");
    await writeFile(join(dir, `${script.id}-tiktok.txt`), script.tiktokCaption, "utf8");
    await writeFile(join(dir, `${script.id}-x.txt`), script.xCaption, "utf8");
    if (script.youtubeDescription) {
      await writeFile(
        join(dir, `${script.id}-youtube.txt`),
        `TITLE:\n${script.youtubeTitle}\n\nDESCRIPTION:\n${script.youtubeDescription}\n\nTAGS:\n${script.youtubeTags}\n`,
        "utf8",
      );
    }
  }

  await writeFile(join(dir, "CAPCUT-BRIEF.txt"), capCutBrief(plan, scripts), "utf8");

  console.log(`\n✓ Day ${dayNumber} pack written → ${dir}`);
  console.log(`  ${scripts.length} scripts · manifest + CapCut brief`);
  return { dir, scripts };
}

function formatScriptForCapCut(script) {
  return [
    `SYNEXUS LAUNCH · ${script.id}`,
    `Format: ${script.formatLabel}`,
    "",
    "🎬 HOOK (0–2s)",
    script.hook,
    "",
    "⚙️ BUILD (2–10s)",
    script.build,
    "",
    "💥 PAYOFF (10–20s)",
    script.payoff,
    "",
    "🔁 LOOP",
    script.loop,
    "",
    "🎙️ VOICEOVER (ElevenLabs / auto TTS)",
    script.voiceover,
    "",
    "📱 TIKTOK CAPTION",
    script.tiktokCaption,
  ].join("\n");
}

function capCutBrief(plan, scripts) {
  return [
    "CAPCUT EDITING BRIEF — SYNEXUS LAUNCH",
    `Day ${plan.day}: ${plan.title}`,
    "",
    "TEMPLATE:",
    "  · 9:16 vertical · 15–22s",
    "  · Dark green/black background · circuit board overlay",
    "  · Glitch text on hook (Day 1–2)",
    "  · Fake dashboard clip on authority days",
    "  · Syn-Bunny bottom-right on payoff",
    "",
    "AUDIO:",
    "  · Calm synthetic authority (Aria neural, steady pace)",
    "  · Low drone SFX under hook optional",
    "",
    "TEXT ON SCREEN:",
    "  · Hook = largest text, 0–2s",
    "  · AVOID · WATCH · OK badge at payoff",
    "  · synexus.pro watermark entire video",
    "",
    `Scripts today: ${scripts.length}`,
    scripts.map((s) => `  - ${s.id}: ${s.hook.slice(0, 50)}`).join("\n"),
  ].join("\n");
}

async function renderDay(dayNumber, force) {
  const scripts = await resolveScripts(dayNumber);
  console.log(`\nRendering Day ${dayNumber} · ${scripts.length} videos…`);
  const results = await renderLaunchDay(scripts, { force, quiet: false });
  const rendered = results.filter((r) => !r.skipped).length;
  console.log(`\n✓ Rendered ${rendered} new videos (${results.length} total)`);
  return results;
}

async function blastDay(dayNumber, slot = 0, force = false) {
  const scripts = await resolveScripts(dayNumber);
  const script = scripts[slot % scripts.length];
  if (!script) {
    console.warn("No script for slot");
    return;
  }

  console.log(`\nBlast Day ${dayNumber} slot ${slot + 1} · ${script.id}`);
  console.log(`Hook: ${script.hook}`);

  await renderLaunchVideoIfNeeded(script);

  const dir = launchDayPath(dayNumber);
  const videoPath = join(dir, `${script.id}.mp4`);
  const metadataPath = join(dir, `${script.id}-youtube.txt`);
  const appOrigin = process.env.APP_ORIGIN?.trim() || "https://synexus.pro";

  const state = await readLaunchState();
  state.posted[`d${dayNumber}-s${slot}`] = { scriptId: script.id, at: new Date().toISOString() };
  if (!state.startedAt) state.startedAt = new Date().toISOString();
  await writeLaunchState(state);

  await runBlastSlot({
    slot,
    force,
    quiet: false,
    launch: {
      dayDir: dir,
      scriptId: script.id,
      dayLabel: `day-${String(dayNumber).padStart(2, "0")}`,
      videoPath,
      metadataPath,
      captions: {
        telegram: script.telegramCaption,
        tiktok: script.tiktokCaption,
        facebook: script.tiktokCaption,
        instagram: script.tiktokCaption,
        x: script.xCaption,
        reddit: `${script.hook}\n\n${script.build}\n\n${script.payoff}\n\nTry: ${appOrigin}`,
      },
    },
  });
}

async function renderLaunchVideoIfNeeded(script) {
  const { renderLaunchVideo } = await import("./viralLaunchRender.js");
  await renderLaunchVideo(script, { force: false, quiet: true });
}

async function runFullDay(dayNumber, force) {
  await writeDayPack(dayNumber);
  await renderDay(dayNumber, force);
  const scripts = await resolveScripts(dayNumber);
  const slots = Math.min(3, scripts.length);
  for (let s = 0; s < slots; s += 1) {
    await blastDay(dayNumber, s, force);
  }
}

async function watchLaunch(force) {
  console.log("\nSynexus 7-day launch watch — runs current day pack + 3 blast slots");
  console.log(`Set LAUNCH_START_DATE=YYYY-MM-DD in marketing-ai/.env\n`);

  const tick = async () => {
    const day = currentLaunchDayIndex();
    console.log(`\n[${new Date().toLocaleString()}] Launch Day ${day}/7`);
    try {
      await runFullDay(day, force);
    } catch (err) {
      console.error("[launch]", err.message || err);
    }
  };

  await tick();
  setInterval(tick, 86_400_000);
}

async function main() {
  const args = process.argv.slice(2);
  const { force, watch, help } = parseArgs(args);
  const dayArg = args.find((a) => a.startsWith("--day="))?.split("=")[1] || args[args.indexOf("--day") + 1];
  const idArg = args.find((a) => a.startsWith("--id="))?.split("=")[1] || args[args.indexOf("--id") + 1];

  if (help || args.includes("--plan")) {
    printPlan();
    return;
  }

  if (args.includes("--winner") && idArg) {
    await recordWinner(idArg, { views: Number(args.find((a) => a.startsWith("--views="))?.split("=")[1] || 0) });
    console.log(`✓ Recorded winner: ${idArg} (for Day 6 remix)`);
    return;
  }

  if (args.includes("--write")) {
    const day = Number(dayArg) || currentLaunchDayIndex();
    await writeDayPack(day);
    return;
  }

  if (args.includes("--render")) {
    const day = Number(dayArg) || currentLaunchDayIndex();
    await renderDay(day, force);
    return;
  }

  if (args.includes("--blast")) {
    const day = Number(dayArg) || currentLaunchDayIndex();
    const slot = Number(args.find((a) => a.startsWith("--slot="))?.split("=")[1] || 0);
    await blastDay(day, slot, force);
    return;
  }

  if (watch || args.includes("--watch")) {
    await watchLaunch(force);
    return;
  }

  if (dayArg || args.includes("--day")) {
    const day = Number(dayArg) || currentLaunchDayIndex();
    await runFullDay(day, force);
    return;
  }

  printPlan();
  console.log("Commands:");
  console.log("  npm run launch:write -- --day 1");
  console.log("  npm run launch:render -- --day 1");
  console.log("  npm run launch:day -- --day 1");
  console.log("  npm run launch:watch");
  console.log("  npm run launch:winner -- --id d5-s3 --views=50000");
}

const isMain =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) || process.argv[1].endsWith("viralLaunchRunner.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}

export { printPlan, writeDayPack, renderDay, runFullDay };
