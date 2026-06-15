import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { google } from "googleapis";
import { fileExists } from "./videoPipeline.js";

const UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

export function hasYouTubeCredentials() {
  return Boolean(
    process.env.YOUTUBE_CLIENT_ID?.trim() &&
      process.env.YOUTUBE_CLIENT_SECRET?.trim() &&
      process.env.YOUTUBE_REFRESH_TOKEN?.trim(),
  );
}

export function getYouTubeConfig() {
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET?.trim() || "",
    redirectUri: process.env.YOUTUBE_REDIRECT_URI?.trim() || "http://localhost",
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN?.trim() || "",
    privacy: process.env.YOUTUBE_PRIVACY?.trim() || "public",
    categoryId: process.env.YOUTUBE_CATEGORY_ID?.trim() || "28",
  };
}

export async function getYouTubeClient() {
  if (!hasYouTubeCredentials()) {
    throw new Error(
      "YouTube credentials missing. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in marketing-ai/.env",
    );
  }

  const cfg = getYouTubeConfig();
  const oauth2 = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
  oauth2.setCredentials({ refresh_token: cfg.refreshToken });

  return google.youtube({ version: "v3", auth: oauth2 });
}

export function parseYouTubeMetadata(text) {
  function block(name) {
    const marker = `${name}:\n`;
    const start = text.indexOf(marker);
    if (start === -1) return "";
    const rest = text.slice(start + marker.length);
    const next = rest.search(/\n[A-Z][A-Z /]+:\n/);
    return (next === -1 ? rest : rest.slice(0, next)).trim();
  }

  const tagsRaw = block("TAGS");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30);

  return {
    title: block("TITLE"),
    description: block("DESCRIPTION"),
    tags,
  };
}

export async function readYouTubeMetadata(metadataPath) {
  const text = await readFile(metadataPath, "utf8");
  return parseYouTubeMetadata(text);
}

function shortsTitle(title) {
  const base = title.trim();
  if (!base) return "Synexus Daily #Shorts";
  if (base.toLowerCase().includes("#shorts")) return base.slice(0, 100);
  const withTag = `${base} #Shorts`;
  return withTag.length <= 100 ? withTag : `${base.slice(0, 91)} #Shorts`;
}

export async function readUploadRecord(dayDir) {
  const path = join(dayDir, "youtube.json");
  if (!(await fileExists(path))) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

export async function writeUploadRecord(dayDir, record) {
  const path = join(dayDir, "youtube.json");
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
}

export async function uploadVideoToYouTube({
  videoPath,
  metadataPath,
  dayDir,
  force = false,
  quiet = false,
}) {
  if (!(await fileExists(videoPath))) {
    throw new Error(`Video not found: ${videoPath}`);
  }
  if (!(await fileExists(metadataPath))) {
    throw new Error(`Metadata not found: ${metadataPath}`);
  }

  const existing = await readUploadRecord(dayDir);
  if (existing?.videoId && !force) {
    if (!quiet) {
      console.log(`Already on YouTube (${existing.videoId}): ${existing.url}`);
    }
    return { skipped: true, ...existing };
  }

  const metadata = await readYouTubeMetadata(metadataPath);
  const cfg = getYouTubeConfig();
  const youtube = await getYouTubeClient();

  const title = shortsTitle(metadata.title);
  const description = metadata.description;
  const tags = metadata.tags.length ? metadata.tags : ["Synexus", "Solana", "Shorts"];

  if (!quiet) {
    console.log("\n5/5 Uploading to YouTube…");
    console.log(`  Title: ${title}`);
  }

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: cfg.categoryId,
        defaultLanguage: "en",
      },
      status: {
        privacyStatus: cfg.privacy,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(videoPath),
    },
  }).catch((err) => {
    const msg = err?.response?.data?.error?.message || err.message || String(err);
    if (msg.includes("invalid_grant")) {
      throw new Error(
        "YouTube refresh token expired or revoked. Run: npm run youtube:auth — then npm run youtube:daily",
      );
    }
    throw new Error(`YouTube upload failed: ${msg}`);
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error("YouTube upload succeeded but no video ID was returned.");
  }

  const url = `https://www.youtube.com/shorts/${videoId}`;
  const record = {
    videoId,
    url,
    title,
    privacy: cfg.privacy,
    uploadedAt: new Date().toISOString(),
  };

  await writeUploadRecord(dayDir, record);

  if (!quiet) {
    console.log("\n✓ Published to YouTube");
    console.log(`  ${url}`);
  }

  return { skipped: false, ...record };
}
