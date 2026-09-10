/**
 * Records a mobile walkthrough of the SyNexus app and adds acquisition voiceover.
 *
 *   npm run dev          # root — port 5173
 *   npm run acquisition:demo --prefix marketing-ai
 *
 * Output: marketing-ai/output/acquisition-demo/synexus-acquisition-demo.mp4
 */
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { runFfmpeg, synthesizeVoiceover } from "./videoPipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "output", "acquisition-demo");
const BASE = process.env.APP_ORIGIN?.trim() || "http://localhost:5173";
const VIEWPORT = { width: 460, height: 900 };

const VOICEOVER = [
  "Welcome to SyNexus.",
  "AI-powered Solana trading intelligence.",
  "Detect scams, track whales, monitor momentum, and trade smarter.",
  "Paste any token, get a Sentinel verdict in seconds.",
  "Command Oracle Supreme and your Sentinels from Pulse.",
  "Start your free trial at synexus.pro.",
].join(" ");

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForApp(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector(".landing-hero, .page", { timeout: 60_000 });
}

async function runWalkthrough(page) {
  await sleep(2500);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(1800);

  await page.evaluate(() => window.scrollBy({ top: 520, behavior: "smooth" }));
  await sleep(2200);

  const search = page.locator('input[placeholder*="Search"], input[placeholder*="search"], .coin-search-panel input').first();
  if (await search.count()) {
    await search.scrollIntoViewIfNeeded();
    await search.fill("SOL");
    await sleep(2000);
  }

  const tokenLink = page.locator('a[href^="/token/"]').first();
  if (await tokenLink.count()) {
    await tokenLink.click();
    await page.waitForURL(/\/token\//, { timeout: 30_000 });
    await sleep(3500);
    await page.evaluate(() => window.scrollBy({ top: 280, behavior: "smooth" }));
    await sleep(2500);
  }

  await page.goto(`${BASE}/pulse`, { waitUntil: "networkidle", timeout: 60_000 });
  await sleep(3000);
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await sleep(2500);

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(2000);
}

async function findRecordedWebm(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const videos = entries.filter((e) => e.isFile() && e.name.endsWith(".webm"));
  if (!videos.length) throw new Error(`No .webm recording in ${dir}`);
  return join(dir, videos[0].name);
}

async function muxVoiceover(rawVideoPath, audioPath, outPath) {
  await runFfmpeg(
    [
      "-y",
      "-i",
      rawVideoPath,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      outPath,
    ],
    { quiet: true },
  );
}

export async function recordAcquisitionDemo() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Recording app walkthrough from ${BASE} …`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
    colorScheme: "dark",
  });

  await context.addInitScript(() => {
    try {
      localStorage.setItem("synexus_boot_intro_seen", "1");
      sessionStorage.setItem("synexus_intro_welcome_spoken", "1");
      sessionStorage.setItem("oracle_supreme_greeted_session", "1");
    } catch {
      /* ignore */
    }
  });

  const page = await context.newPage();
  try {
    await waitForApp(page);
    await runWalkthrough(page);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawWebm = await findRecordedWebm(OUT_DIR);
  const rawMp4 = join(OUT_DIR, "walkthrough-raw.mp4");
  await runFfmpeg(
    ["-y", "-i", rawWebm, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", rawMp4],
    { quiet: true },
  );

  console.log("Synthesizing acquisition voiceover …");
  const audioDir = join(OUT_DIR, "audio");
  const audioPath = await synthesizeVoiceover(VOICEOVER, audioDir, process.env.VIDEO_TTS_VOICE, {
    style: "natural",
  });

  const finalPath = join(OUT_DIR, "synexus-acquisition-demo.mp4");
  await muxVoiceover(rawMp4, audioPath, finalPath);

  console.log("\n✓ Acquisition demo ready");
  console.log(`  ${finalPath}`);
  return finalPath;
}

const isMain = process.argv[1]?.endsWith("recordAcquisitionDemo.js");
if (isMain) {
  recordAcquisitionDemo().catch((err) => {
    console.error("[acquisition demo]", err.message || err);
    process.exit(1);
  });
}
