import { writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "../videoPipeline.js";

/** X (Twitter) — export bundle (API posting requires paid tier). */
export async function exportXBundle({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  if (!(await fileExists(videoPath))) {
    throw new Error(`Video missing: ${videoPath}`);
  }

  const suffix = slot === 0 ? "" : `-slot${slot + 1}`;
  const xVideo = join(dayDir, `synexus-x${suffix}.mp4`);
  const xCaption = join(dayDir, `x-post${suffix}.txt`);

  await copyFile(videoPath, xVideo);
  await writeFile(xCaption, `${caption}\n`, "utf8");

  if (!quiet) {
    console.log(`✓ X/Twitter bundle (slot ${slot + 1})`);
    console.log(`  Video: ${xVideo}`);
    console.log(`  Post:  ${xCaption}`);
  }

  return { videoPath: xVideo, captionPath: xCaption, slot, mode: "export" };
}

export function hasXApiConfig() {
  return Boolean(
    process.env.X_API_KEY?.trim() &&
      process.env.X_API_SECRET?.trim() &&
      process.env.X_ACCESS_TOKEN?.trim() &&
      process.env.X_ACCESS_SECRET?.trim(),
  );
}

export async function publishX({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  const bundle = await exportXBundle({ dayDir, videoPath, caption, slot, quiet: !quiet });
  if (!hasXApiConfig()) {
    if (!quiet) {
      console.log(`  ↷ X export · slot ${slot + 1} — upload manually or set X_* API keys`);
    }
    return bundle;
  }

  // Full X API v1.1 media upload is multi-step — export is reliable; API optional later.
  if (!quiet) console.log(`  ↷ X API keys set — use export for now (slot ${slot + 1})`);
  return bundle;
}

export async function checkX() {
  const dayDir = process.env.VIDEO_OUTPUT_DIR || "output";
  return {
    ok: true,
    configured: hasXApiConfig(),
    mode: hasXApiConfig() ? "API keys set · export ready" : "Export bundle for manual post",
    fix: hasXApiConfig() ? undefined : "Post synexus-x.mp4 + x-post.txt from output/YYYY-MM-DD/",
  };
}
