import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileExists, renderSvgToPng } from "./videoPipeline.js";
import { renderSceneSvg } from "./videoArt.js";
import { buildScenes, buildVideoJob } from "./videoBlueprint.js";

function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "https://synexus.pro";
}

/** Square + story ad images + upload checklist for every platform. */
export async function exportAdCreatives({ dayDir, slot = 0, captions = {}, quiet = false }) {
  const scenesDir = join(dayDir, "scenes");
  const introPng = join(scenesDir, "01-intro.png");
  const suffix = slot === 0 ? "" : `-slot${slot + 1}`;

  const adStory = join(dayDir, `synexus-ad-story${suffix}.png`);
  const adSquare = join(dayDir, `synexus-ad-square${suffix}.png`);

  if (await fileExists(introPng)) {
    await copyFile(introPng, adStory);
  } else {
    const job = buildVideoJob();
    const scene = buildScenes(job.pack)[0];
    const svg = renderSceneSvg(scene);
    await renderSvgToPng(svg, adStory);
  }

  // Square crop variant — reuse intro for FB/IG feed ads
  await copyFile(adStory, adSquare);

  const bunny = join(dayDir, "syn-bunny.png");
  const checklist = [
    "Synexus daily ad bundle",
    `Slot: ${slot + 1}`,
    "",
    "Videos (vertical 9:16):",
    `  synexus-daily.mp4`,
    `  synexus-facebook${suffix}.mp4`,
    `  synexus-instagram-reel${suffix}.mp4`,
    `  synexus-tiktok${suffix}.mp4`,
    `  synexus-x${suffix}.mp4`,
    "",
    "Images:",
    `  synexus-ad-story${suffix}.png  → Stories / Reels cover`,
    `  synexus-ad-square${suffix}.png  → Feed ads`,
    `  syn-bunny.png                   → Telegram / avatar`,
    "",
    "Captions:",
    `  facebook-caption${suffix}.txt`,
    `  instagram-caption${suffix}.txt`,
    `  tiktok-caption${suffix}.txt`,
    `  x-post${suffix}.txt`,
    `  telegram-update.txt`,
    "",
    `App link: ${appOrigin()}`,
    "",
    captions.facebook ? `Facebook:\n${captions.facebook}\n` : "",
    captions.instagram ? `Instagram:\n${captions.instagram}\n` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const checklistPath = join(dayDir, `upload-checklist${suffix}.txt`);
  await writeFile(checklistPath, checklist, "utf8");

  if (!quiet) {
    console.log(`✓ Ad creatives · slot ${slot + 1}`);
    console.log(`  Story: ${adStory}`);
    console.log(`  Checklist: ${checklistPath}`);
  }

  return { adStory, adSquare, bunny: (await fileExists(bunny)) ? bunny : null, checklistPath };
}
