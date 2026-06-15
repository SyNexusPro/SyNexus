import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "../videoPipeline.js";

export function hasTikTokApiConfig() {
  return Boolean(process.env.TIKTOK_ACCESS_TOKEN?.trim());
}

/** Prepare same vertical video + caption for TikTok (manual or API). */
export async function exportTikTokBundle({ dayDir, videoPath, caption, quiet = false }) {
  if (!(await fileExists(videoPath))) {
    throw new Error(`Video missing for TikTok export: ${videoPath}`);
  }

  const tiktokVideo = join(dayDir, "synexus-tiktok.mp4");
  const captionPath = join(dayDir, "tiktok-caption.txt");
  await copyFile(videoPath, tiktokVideo);
  await writeFile(captionPath, `${caption}\n`, "utf8");

  if (!quiet) {
    console.log("✓ TikTok bundle ready");
    console.log(`  Video:   ${tiktokVideo}`);
    console.log(`  Caption: ${captionPath}`);
  }

  return { videoPath: tiktokVideo, captionPath };
}

/**
 * TikTok Content Posting API (optional — requires approved TikTok developer app).
 * @see https://developers.tiktok.com/doc/content-posting-api-get-started
 */
export async function postTikTokVideo({ videoPath, caption, quiet = false }) {
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("TIKTOK_ACCESS_TOKEN not set — bundle exported for manual upload");
  }

  // Init upload flow — simplified; full flow needs chunked upload for large files.
  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 2200),
        privacy_level: process.env.TIKTOK_PRIVACY?.trim() || "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: (await readFile(videoPath)).byteLength,
        chunk_size: 10_000_000,
        total_chunk_count: 1,
      },
    }),
  });

  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    throw new Error(initData.error?.message || "TikTok init upload failed — use exported bundle manually");
  }

  if (!quiet) console.log("✓ TikTok upload initiated (complete in TikTok developer console if needed)");
  return { init: initData.data, mode: "api-init" };
}

export async function publishTikTok({ dayDir, videoPath, caption, quiet = false }) {
  const bundle = await exportTikTokBundle({ dayDir, videoPath, caption, quiet: true });

  if (hasTikTokApiConfig()) {
    try {
      const api = await postTikTokVideo({ videoPath: bundle.videoPath, caption, quiet });
      if (!quiet) console.log("✓ TikTok API publish started");
      return { ...bundle, ...api, mode: "api" };
    } catch (err) {
      if (!quiet) console.warn(`TikTok API skipped: ${err.message}`);
    }
  }

  if (!quiet) {
    console.log("✓ TikTok bundle ready (upload app or connect TIKTOK_ACCESS_TOKEN for API)");
    console.log(`  Video:   ${bundle.videoPath}`);
    console.log(`  Caption: ${bundle.captionPath}`);
  }

  return { ...bundle, mode: "export" };
}
