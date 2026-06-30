#!/usr/bin/env node
/**
 * SyNexus Viral Daily Runner v1.0
 * 3 Shorts + 1 long-form + thumbnails per day
 *
 *   npm run viral:plan
 *   npm run viral:pack -- --write
 *   npm run viral:render -- --force
 *   npm run viral:day -- --force
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { printSystemBrief, SCHEDULE } from "./viralContentSystem.js";
import { generateDailyViralPack } from "./viralScriptFactory.js";
import { renderViralScript } from "./viralLaunchRender.js";
import { writeThumbnail } from "./thumbnailGenerator.js";
import { runBlastSlot } from "./dailyBlastPost.js";
import { parseArgs } from "./videoUtils.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function viralDayDir(dateKey) {
  return join(__dirname, "output", "viral", dateKey);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function writeDailyPack(pack) {
  const dir = viralDayDir(pack.dateKey);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), JSON.stringify(pack, null, 2), "utf8");

  for (const script of [...pack.shorts, pack.longForm]) {
    await writeFile(join(dir, `${script.id}.json`), JSON.stringify(script, null, 2), "utf8");
  }

  for (const thumb of pack.thumbnails) {
    const png = join(dir, "thumbnails", `${thumb.scriptId}.png`);
    await writeThumbnail(thumb.words, png);
    thumb.path = png;
  }

  console.log(`\n✓ Viral pack → ${dir}`);
  console.log(`  ${pack.shorts.length} Shorts · 1 long-form · ${pack.thumbnails.length} thumbnails`);
  return dir;
}

async function renderPack(pack, { force = false, quiet = false } = {}) {
  const dir = viralDayDir(pack.dateKey);
  const all = [...pack.shorts, pack.longForm];
  const results = [];

  for (const script of all) {
    const r = await renderViralScript(script, {
      force,
      quiet,
      outDir: dir,
      long: script.long,
    });
    results.push(r);
  }

  return results;
}

async function blastShorts(pack, { force = false } = {}) {
  for (let slot = 0; slot < pack.shorts.length; slot += 1) {
    const script = pack.shorts[slot];
    const videoPath = join(viralDayDir(pack.dateKey), `${script.id}.mp4`);
    const metadataPath = join(viralDayDir(pack.dateKey), `${script.id}-youtube.txt`);

    await runBlastSlot({
      slot,
      force,
      quiet: false,
      launch: {
        dayDir: viralDayDir(pack.dateKey),
        scriptId: script.id,
        dayLabel: pack.dateKey,
        videoPath,
        metadataPath,
        captions: {
          telegram: script.telegramCaption,
          tiktok: script.tiktokCaption,
          facebook: script.tiktokCaption,
          instagram: script.tiktokCaption,
          x: script.xCaption,
          reddit: `${script.hook}\n\n${script.cta}\n\n${process.env.APP_ORIGIN || "https://synexus.pro"}`,
        },
      },
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const { force, help } = parseArgs(args);
  const dateArg = args.find((a) => a.startsWith("--date="))?.split("=")[1];
  const dateKey = dateArg || todayKey();

  if (help || args.includes("--plan")) {
    printSystemBrief();
    console.log("Daily output:");
    console.log(`  ${SCHEDULE.shortsPerDay} Shorts at hours ${SCHEDULE.postHours.slice(0, 3).join(", ")}`);
    console.log(`  1 long-form at hour ${SCHEDULE.postHours[SCHEDULE.longSlot]}`);
    console.log("\nCommands:");
    console.log("  npm run viral:pack");
    console.log("  npm run viral:render -- --force");
    console.log("  npm run viral:day -- --force");
    return;
  }

  const pack = generateDailyViralPack(new Date(`${dateKey}T12:00:00`));

  if (args.includes("--write") || args.includes("--pack")) {
    await writeDailyPack(pack);
    return;
  }

  if (args.includes("--render")) {
    try {
      const raw = await readFile(join(viralDayDir(dateKey), "manifest.json"), "utf8");
      await renderPack(JSON.parse(raw), { force, quiet: false });
    } catch {
      await writeDailyPack(pack);
      await renderPack(pack, { force, quiet: false });
    }
    return;
  }

  if (args.includes("--blast")) {
    const raw = await readFile(join(viralDayDir(dateKey), "manifest.json"), "utf8");
    await blastShorts(JSON.parse(raw), { force });
    return;
  }

  if (args.includes("--day")) {
    await writeDailyPack(pack);
    await renderPack(pack, { force, quiet: false });
    console.log("\nBlast Shorts: npm run viral:blast -- --force");
    return;
  }

  printSystemBrief();
}

const isMain =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
    process.argv[1].endsWith("viralDailyRunner.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

export { writeDailyPack, renderPack, viralDayDir };
