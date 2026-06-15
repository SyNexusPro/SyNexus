#!/usr/bin/env node
/** Export Syn bunny PNG + SVG to marketing-ai/assets and public/. */

import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSynBunnyStandaloneSvg, clearSynBunnyCache } from "./synBunny.js";
import { renderSvgToPng } from "./videoPipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "assets");
const publicDir = join(__dirname, "..", "public");

async function main() {
  await mkdir(assetsDir, { recursive: true });
  const svg = renderSynBunnyStandaloneSvg(512);
  const svgPath = join(assetsDir, "syn-bunny.svg");
  const pngPath = join(assetsDir, "syn-bunny.png");
  await writeFile(svgPath, svg, "utf8");
  await renderSvgToPng(svg, pngPath);
  await writeFile(join(publicDir, "syn-bunny.svg"), svg, "utf8");
  await copyFile(pngPath, join(publicDir, "syn-bunny.png"));
  clearSynBunnyCache();
  console.log("✓ Syn bunny exported");
  console.log(" ", pngPath);
  console.log(" ", join(publicDir, "syn-bunny.png"));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
