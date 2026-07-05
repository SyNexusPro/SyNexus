#!/usr/bin/env node
/** Print hype post queue — what's ready vs posted. npm run hype:queue */

import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATIVE_SLOTS } from "./hypeAssetCatalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREATIVES = join(__dirname, "assets", "hype-creatives");
const STATE = join(__dirname, "output", "hype-assets", "blast-state.json");
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

async function main() {
  let posted = {};
  try {
    posted = JSON.parse(await readFile(STATE, "utf8")).posted ?? {};
  } catch {
    /* no state yet */
  }

  let names = [];
  try {
    names = await readdir(CREATIVES);
  } catch {
    names = [];
  }

  const ready = [];
  const missing = [];
  const done = [];

  for (const slot of CREATIVE_SLOTS) {
    const hasFile = names.some(
      (n) =>
        n.toLowerCase().startsWith(slot.prefix.toLowerCase()) &&
        IMAGE_EXT.some((e) => n.toLowerCase().endsWith(e)),
    );
    if (posted[slot.id]) {
      done.push(slot);
    } else if (hasFile) {
      ready.push(slot);
    } else {
      missing.push(slot);
    }
  }

  console.log("\nSyNexus hype queue\n");
  if (done.length) {
    console.log("Posted (skip unless --force):");
    for (const s of done) console.log(`  ✓ ${s.id}`);
  }
  if (ready.length) {
    console.log("\nReady to post:");
    for (const s of ready) {
      console.log(`  → npm run hype:post -- --only=${s.id}`);
    }
  }
  if (missing.length) {
    console.log("\nNeed PNG in assets/hype-creatives/:");
    for (const s of missing) console.log(`  · ${s.prefix}.png`);
  }
  if (ready[0]) {
    console.log(`\nNext command:\n  npm run hype:post -- --only=${ready[0].id}\n`);
  } else if (missing[0]) {
    console.log(`\nAdd ${missing[0].prefix}.png then run hype:post.\n`);
  } else {
    console.log("\nAll creatives with files have been posted.\n");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
