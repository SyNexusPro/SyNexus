import { readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "../videoPipeline.js";
import {
  getXCreds,
  hasXCreds,
  oauthFormPost,
  oauthGet,
  oauthJsonPost,
  oauthMultipartPost,
} from "./xOAuth.js";

const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const TWEETS_URL = "https://api.twitter.com/2/tweets";
const VERIFY_URL = "https://api.twitter.com/1.1/account/verify_credentials.json";
const CHUNK_BYTES = 4 * 1024 * 1024;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mediaIdString(data) {
  return String(data.media_id_string || data.media_id || "");
}

function formatTweetText(caption) {
  const firstBlock = String(caption)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
  const text = firstBlock || String(caption).trim();
  if (text.length <= 280) return text;
  return `${text.slice(0, 277)}…`;
}

/** X (Twitter) — export bundle + optional API video post. */
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
  return hasXCreds();
}

async function appendVideoChunk(mediaId, segmentIndex, chunk, creds) {
  const signParams = {
    command: "APPEND",
    media_id: mediaId,
    segment_index: String(segmentIndex),
  };
  const form = new FormData();
  form.append("command", "APPEND");
  form.append("media_id", mediaId);
  form.append("segment_index", String(segmentIndex));
  form.append("media", new Blob([chunk], { type: "application/octet-stream" }), "video.mp4");
  await oauthMultipartPost(UPLOAD_URL, signParams, form, creds);
}

async function waitForVideoProcessing(mediaId, initial, creds, quiet) {
  let info = initial.processing_info;
  if (!info) return;

  let attempts = 0;
  while (info && (info.state === "pending" || info.state === "in_progress")) {
    attempts += 1;
    if (attempts > 40) {
      throw new Error("X video processing timed out");
    }
    const waitMs = Math.max(2000, (info.check_after_secs || 3) * 1000);
    if (!quiet) process.stderr.write(".");
    await sleep(waitMs);

    const status = await oauthGet(UPLOAD_URL, { command: "STATUS", media_id: mediaId }, creds);
    info = status.processing_info;
    if (info?.state === "failed") {
      throw new Error(info.error?.message || "X video processing failed");
    }
  }
  if (!quiet) process.stderr.write("\n");
}

export async function uploadVideoToX(videoPath, { quiet = false } = {}) {
  const creds = getXCreds();
  if (!hasXCreds(creds)) {
    throw new Error("X API not configured — run npm run x:auth");
  }

  const fileStat = await stat(videoPath);
  const buffer = await readFile(videoPath);
  const totalBytes = fileStat.size;

  if (!quiet) {
    console.log(`  Uploading ${(totalBytes / 1_048_576).toFixed(1)} MB video to X…`);
  }

  const init = await oauthFormPost(
    UPLOAD_URL,
    {
      command: "INIT",
      total_bytes: String(totalBytes),
      media_type: "video/mp4",
      media_category: "tweet_video",
    },
    creds,
  );

  const mediaId = mediaIdString(init);
  if (!mediaId) throw new Error("X media INIT missing media_id");

  let segmentIndex = 0;
  for (let offset = 0; offset < totalBytes; offset += CHUNK_BYTES) {
    const chunk = buffer.subarray(offset, Math.min(offset + CHUNK_BYTES, totalBytes));
    await appendVideoChunk(mediaId, segmentIndex, chunk, creds);
    segmentIndex += 1;
  }

  const finalized = await oauthFormPost(
    UPLOAD_URL,
    {
      command: "FINALIZE",
      media_id: mediaId,
    },
    creds,
  );

  if (!quiet) process.stderr.write("  Processing on X");
  await waitForVideoProcessing(mediaId, finalized, creds, quiet);

  return mediaId;
}

export async function postTweetWithVideo({ text, mediaId, quiet = false }) {
  const creds = getXCreds();
  const payload = {
    text: formatTweetText(text),
    media: { media_ids: [String(mediaId)] },
  };

  const result = await oauthJsonPost(TWEETS_URL, payload, creds);
  const tweetId = result?.data?.id;
  if (!tweetId) {
    throw new Error(`X tweet post failed: ${JSON.stringify(result).slice(0, 300)}`);
  }

  const url = `https://x.com/i/web/status/${tweetId}`;
  if (!quiet) {
    console.log(`  ✓ X · posted ${url}`);
  }
  return { tweetId, url, mode: "posted" };
}

export async function verifyXCredentials() {
  if (!hasXApiConfig()) {
    return { ok: false, configured: false, error: "Missing X_* keys — run npm run x:auth" };
  }
  try {
    const creds = getXCreds();
    const account = await oauthGet(VERIFY_URL, { skip_status: "true" }, creds);
    return {
      ok: true,
      configured: true,
      screenName: account.screen_name,
      name: account.name,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Returns null if write access works; otherwise an error message. */
export async function probeXWriteAccess() {
  const creds = getXCreds();
  if (!hasXCreds(creds)) return "Missing X_* keys — run npm run x:auth";

  try {
    await oauthFormPost(
      UPLOAD_URL,
      {
        command: "INIT",
        total_bytes: "1000",
        media_type: "video/mp4",
        media_category: "tweet_video",
      },
      creds,
    );
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("oauth1-permissions") || message.includes("oauth1 app permissions")) {
      return "X app is Read-only. Set Read and write in developer.x.com → regenerate Access Token → npm run x:auth";
    }
    if (message.includes("453") || message.toLowerCase().includes("access level")) {
      return "X API write access requires a paid developer tier (Basic $100/mo+) on developer.x.com";
    }
    return message;
  }
}

export async function publishX({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  const bundle = await exportXBundle({ dayDir, videoPath, caption, slot, quiet: true });

  if (!hasXApiConfig()) {
    if (!quiet) {
      console.log(`  ↷ X export · slot ${slot + 1} — set X_* keys + npm run x:auth`);
    }
    return bundle;
  }

  try {
    const mediaId = await uploadVideoToX(videoPath, { quiet });
    const posted = await postTweetWithVideo({ text: caption, mediaId, quiet });
    return { ...bundle, ...posted, videoPath: bundle.videoPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!quiet) {
      console.error(`  ✗ X: ${message}`);
      console.log(`  ↷ X export saved · slot ${slot + 1} — upload ${bundle.videoPath} manually`);
    }
    throw err;
  }
}

export async function checkX() {
  const verify = await verifyXCredentials();
  if (!verify.ok) {
    return {
      ok: false,
      configured: verify.configured,
      mode: verify.configured ? "API keys set · verify failed" : "Export bundle for manual post",
      error: verify.error,
      fix: verify.configured ? verify.error : "Run npm run x:auth",
    };
  }

  const writeError = await probeXWriteAccess();
  if (writeError) {
    return {
      ok: false,
      configured: true,
      screenName: verify.screenName,
      mode: `Signed in as @${verify.screenName} · cannot post yet`,
      error: writeError,
      fix: writeError,
    };
  }

  return {
    ok: true,
    configured: true,
    mode: `Auto-post video · @${verify.screenName}`,
    screenName: verify.screenName,
  };
}
