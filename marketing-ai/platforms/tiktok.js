import { readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileExists } from "../videoPipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const API = "https://open.tiktokapis.com/v2";
const CHUNK_SIZE = 10_000_000;

export function hasTikTokApiConfig() {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY?.trim() &&
      process.env.TIKTOK_CLIENT_SECRET?.trim() &&
      process.env.TIKTOK_REFRESH_TOKEN?.trim(),
  );
}

export function tiktokPostsPerDay() {
  const n = Number(process.env.TIKTOK_POSTS_PER_DAY?.trim() || "3");
  return Math.min(3, Math.max(1, Number.isFinite(n) ? n : 3));
}

async function upsertEnv(key, value) {
  let text = "";
  try {
    text = await readFile(ENV_PATH, "utf8");
  } catch {
    text = "";
  }
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  const next = re.test(text) ? text.replace(re, line) : `${text.trim()}\n${line}\n`;
  await writeFile(ENV_PATH, next.trimStart(), "utf8");
}

function clientKey() {
  return process.env.TIKTOK_CLIENT_KEY?.trim() || process.env.TIKTOK_CLIENT_ID?.trim() || "";
}

function clientSecret() {
  return process.env.TIKTOK_CLIENT_SECRET?.trim() || "";
}

/** Refresh or return cached access token. Persists new refresh_token if rotated. */
export async function getTikTokAccessToken() {
  const staticToken = process.env.TIKTOK_ACCESS_TOKEN?.trim();
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN?.trim();
  const key = clientKey();
  const secret = clientSecret();

  if (!key || !secret) {
    throw new Error("Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET — run npm run tiktok:auth");
  }

  if (!refreshToken) {
    if (staticToken) return staticToken;
    throw new Error("Set TIKTOK_REFRESH_TOKEN — run npm run tiktok:auth");
  }

  const body = new URLSearchParams({
    client_key: key,
    client_secret: secret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "TikTok token refresh failed — run npm run tiktok:auth");
  }

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await upsertEnv("TIKTOK_REFRESH_TOKEN", data.refresh_token);
  }
  if (data.open_id) {
    await upsertEnv("TIKTOK_OPEN_ID", data.open_id);
  }
  await upsertEnv("TIKTOK_ACCESS_TOKEN", data.access_token);

  return data.access_token;
}

async function tiktokFetch(path, { method = "POST", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  const code = data.error?.code;
  if (!res.ok || (code && code !== "ok")) {
    throw new Error(data.error?.message || data.error?.description || `TikTok API ${path} failed (${res.status})`);
  }
  return data.data ?? data;
}

export async function queryCreatorInfo(token) {
  return tiktokFetch("/post/publish/creator_info/query/", { token, body: {} });
}

function pickPrivacyLevel(creatorInfo) {
  const configured = process.env.TIKTOK_PRIVACY?.trim();
  const options = creatorInfo?.privacy_level_options || [];
  if (configured && options.includes(configured)) return configured;
  if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  if (options.includes("MUTUAL_FOLLOW_FRIENDS")) return "MUTUAL_FOLLOW_FRIENDS";
  return options[0] || "SELF_ONLY";
}

async function uploadVideoChunks(uploadUrl, videoBuffer) {
  const total = videoBuffer.byteLength;
  let offset = 0;
  let chunkIndex = 0;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    const chunk = videoBuffer.subarray(offset, end);
    const contentRange = `bytes ${offset}-${end - 1}/${total}`;

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": contentRange,
      },
      body: chunk,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TikTok video upload chunk ${chunkIndex + 1} failed (${res.status}): ${text.slice(0, 200)}`);
    }

    offset = end;
    chunkIndex += 1;
  }
}

async function waitForPublishStatus(token, publishId, { quiet = false, maxWaitMs = 120_000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const data = await tiktokFetch("/post/publish/status/fetch/", {
      token,
      body: { publish_id: publishId },
    });

    const status = data.status;
    if (status === "PUBLISH_COMPLETE") {
      return { status, publishId, ...data };
    }
    if (status === "FAILED") {
      throw new Error(data.fail_reason || "TikTok publish failed");
    }

    if (!quiet) process.stderr.write(".");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("TikTok publish timed out — check TikTok app for draft status");
}

/**
 * Full Direct Post flow: init → PUT upload → poll status.
 * @see https://developers.tiktok.com/doc/content-posting-api-get-started
 */
export async function postTikTokVideo({ videoPath, caption, quiet = false }) {
  const token = await getTikTokAccessToken();
  const creator = await queryCreatorInfo(token);
  const privacy = pickPrivacyLevel(creator);

  const videoBuffer = await readFile(videoPath);
  const videoSize = videoBuffer.byteLength;
  const totalChunkCount = Math.max(1, Math.ceil(videoSize / CHUNK_SIZE));

  const init = await tiktokFetch("/post/publish/video/init/", {
    token,
    body: {
      post_info: {
        title: caption.slice(0, 2200),
        privacy_level: privacy,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: CHUNK_SIZE,
        total_chunk_count: totalChunkCount,
      },
    },
  });

  const uploadUrl = init.upload_url;
  const publishId = init.publish_id;
  if (!uploadUrl || !publishId) {
    throw new Error("TikTok init missing upload_url or publish_id");
  }

  if (!quiet) console.log(`  Uploading ${(videoSize / 1_048_576).toFixed(1)} MB to TikTok…`);
  await uploadVideoChunks(uploadUrl, videoBuffer);

  if (!quiet) process.stderr.write("  Processing on TikTok");
  const result = await waitForPublishStatus(token, publishId, { quiet });
  if (!quiet) process.stderr.write("\n");

  return {
    publishId,
    status: result.status,
    privacy,
    creator: creator.creator_username || creator.creator_nickname,
    mode: "api",
  };
}

/** Prepare vertical video + caption for one slot (manual or API). */
export async function exportTikTokBundle({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  if (!(await fileExists(videoPath))) {
    throw new Error(`Video missing for TikTok export: ${videoPath}`);
  }

  const suffix = slot === 0 ? "" : `-slot${slot + 1}`;
  const tiktokVideo = join(dayDir, `synexus-tiktok${suffix}.mp4`);
  const captionPath = join(dayDir, `tiktok-caption${suffix}.txt`);
  await copyFile(videoPath, tiktokVideo);
  await writeFile(captionPath, `${caption}\n`, "utf8");

  if (!quiet) {
    console.log(`✓ TikTok bundle ready (slot ${slot + 1})`);
    console.log(`  Video:   ${tiktokVideo}`);
    console.log(`  Caption: ${captionPath}`);
  }

  return { videoPath: tiktokVideo, captionPath, slot };
}

export async function publishTikTok({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  const bundle = await exportTikTokBundle({ dayDir, videoPath, caption, slot, quiet: true });

  if (hasTikTokApiConfig()) {
    const api = await postTikTokVideo({ videoPath: bundle.videoPath, caption, quiet });
    if (!quiet) {
      console.log(`✓ TikTok posted (slot ${slot + 1})${api.creator ? ` → @${api.creator}` : ""}`);
      if (api.privacy === "SELF_ONLY") {
        console.log("  Note: unaudited apps post as private until TikTok approves your API client.");
      }
    }
    return { ...bundle, ...api, postedAt: new Date().toISOString() };
  }

  if (!quiet) {
    console.log(`✓ TikTok bundle ready (slot ${slot + 1}) — run npm run tiktok:auth for auto-post`);
    console.log(`  Video:   ${bundle.videoPath}`);
    console.log(`  Caption: ${bundle.captionPath}`);
  }

  return { ...bundle, mode: "export" };
}

/** Verify API credentials without posting. */
export async function checkTikTokApi() {
  if (!hasTikTokApiConfig()) {
    return {
      ok: false,
      configured: false,
      fix: "Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET — then npm run tiktok:auth",
    };
  }

  try {
    const token = await getTikTokAccessToken();
    const creator = await queryCreatorInfo(token);
    return {
      ok: true,
      configured: true,
      creator: creator.creator_username || creator.creator_nickname,
      privacyOptions: creator.privacy_level_options,
      note: "OAuth + video.publish scope active",
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err.message,
      fix: "Run npm run tiktok:auth — ensure video.publish scope is approved",
    };
  }
}
