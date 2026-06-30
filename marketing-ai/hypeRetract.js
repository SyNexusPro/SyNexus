#!/usr/bin/env node
/**
 * Retract bad hype blast posts (Telegram · Facebook · Instagram).
 *   npm run hype:retract
 *   npm run hype:retract -- --telegram=10   # delete last N Telegram messages
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import {
  deleteTelegramMessage,
  discoverHypeTelegramIds,
  discoverTelegramMessageIds,
  hasTelegramConfig,
} from "./platforms/telegram.js";
import {
  deleteFacebookVideo,
  deleteInstagramMedia,
  listRecentMetaPosts,
} from "./platforms/meta.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(__dirname, "output", "hype-assets", "blast-state.json");

const BLAST_START = "2026-06-29T19:30:00.000Z";
const HYPE_MARKER = "Download SyNexus";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function retractTelegram(count = 10) {
  if (!hasTelegramConfig()) {
    console.log("↷ Telegram not configured");
    return [];
  }

  let stateIds = [];
  try {
    const state = JSON.parse(await readFile(STATE_PATH, "utf8"));
    stateIds = Object.values(state.posted || {})
      .map((p) => p.platforms?.telegram?.messageId)
      .filter(Boolean);
  } catch {
    /* no state */
  }

  const hypeIds = await discoverHypeTelegramIds({ limit: count + 5 });
  const recentIds = await discoverTelegramMessageIds(null, count + 5);
  const toDelete = [...new Set([...stateIds, ...hypeIds, ...recentIds])]
    .sort((a, b) => b - a)
    .slice(0, count);
  const deleted = [];

  console.log(`\nTelegram — deleting ${toDelete.length} hype messages…`);
  for (const messageId of toDelete) {
    try {
      await deleteTelegramMessage(messageId);
      deleted.push(messageId);
      console.log(`  ✓ deleted message ${messageId}`);
      await sleep(400);
    } catch (err) {
      console.warn(`  ↷ message ${messageId}: ${err.message}`);
    }
  }
  return deleted;
}

async function retractMeta() {
  const recent = await listRecentMetaPosts({ sinceIso: BLAST_START });
  const deleted = { facebook: [], instagram: [] };

  console.log("\nFacebook — removing hype blast videos…");
  for (const v of recent.facebook) {
    const desc = v.description || "";
    if (!desc.includes(HYPE_MARKER) && !desc.includes("SyNexus")) continue;
    try {
      await deleteFacebookVideo(v.id);
      deleted.facebook.push(v.id);
      console.log(`  ✓ deleted FB video ${v.id}`);
      await sleep(500);
    } catch (err) {
      console.warn(`  ↷ FB ${v.id}: ${err.message}`);
    }
  }

  console.log("\nInstagram — removing hype blast reels…");
  for (const m of recent.instagram) {
    const cap = m.caption || "";
    if (!cap.includes(HYPE_MARKER) && !cap.includes("SyNexus")) continue;
    try {
      await deleteInstagramMedia(m.id);
      deleted.instagram.push(m.id);
      console.log(`  ✓ deleted IG media ${m.id}`);
      await sleep(500);
    } catch (err) {
      console.warn(`  ↷ IG ${m.id}: ${err.message}`);
    }
  }

  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const tgArg = args.find((a) => a.startsWith("--telegram="));
  const tgCount = tgArg ? Number(tgArg.split("=")[1]) : 10;

  console.log("\n🗑️  SyNexus hype retract — removing bad auto-cropped posts\n");

  const telegramDeleted = await retractTelegram(tgCount);
  const metaDeleted = await retractMeta();

  try {
    const state = JSON.parse(await readFile(STATE_PATH, "utf8"));
    state.retractedAt = new Date().toISOString();
    state.retracted = { telegram: telegramDeleted, ...metaDeleted };
    state.posted = {};
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch {
    /* no state file */
  }

  console.log("\n✓ Retract pass complete.");
  console.log(`  Telegram: ${telegramDeleted.length} messages removed`);
  console.log(`  Facebook: ${metaDeleted.facebook.length} videos removed`);
  console.log(`  Instagram: ${metaDeleted.instagram.length} reels removed`);
  console.log("\nDrop your hand-cut files in:");
  console.log("  marketing-ai/assets/hype-creatives/");
  console.log("Then: npm run hype:post -- --force\n");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
