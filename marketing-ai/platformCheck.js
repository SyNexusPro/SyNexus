#!/usr/bin/env node
/**
 * Verify Synexus marketing platform connections (no posts unless --test-post).
 *
 *   npm run platform:check
 *   node platformCheck.js --test-post   # send a tiny Telegram test (optional)
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { loadMarketingEnv } from "./loadEnv.js";
import { hasYouTubeCredentials, readUploadRecord } from "./youtubeUpload.js";
import { hasTelegramConfig, postTelegram } from "./platforms/telegram.js";
import { hasRedditConfig } from "./platforms/reddit.js";
import { checkTikTokApi, hasTikTokApiConfig, tiktokPostsPerDay } from "./platforms/tiktok.js";
import { fileExists } from "./videoPipeline.js";
import { todayDirName } from "./videoBlueprint.js";
import { parseArgs } from "./videoUtils.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function mask(value) {
  if (!value) return "missing";
  return `set (${value.length} chars)`;
}

function icon(ok) {
  if (ok === true) return "✓";
  if (ok === false) return "✗";
  return "○";
}

async function checkYouTube() {
  if (!hasYouTubeCredentials()) {
    return {
      ok: false,
      configured: false,
      fix: "Run npm run youtube:auth and save YOUTUBE_* in marketing-ai/.env",
    };
  }

  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI?.trim() || "http://localhost",
    );
    oauth2.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
    const { token } = await oauth2.getAccessToken();
    if (!token) throw new Error("No access token returned");

    const dayDir = join(__dirname, "output", todayDirName());
    const lastUpload = await readUploadRecord(dayDir);

    return {
      ok: true,
      configured: true,
      note: "OAuth refresh token is valid (upload scope)",
      todayUpload: lastUpload?.url || null,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err.message,
      fix: "Run npm run youtube:auth to re-authorize",
    };
  }
}

async function checkTelegram({ testPost = false } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "@thesynexusofficial";

  if (!token) {
    return {
      ok: false,
      configured: false,
      fix: "Set TELEGRAM_BOT_TOKEN in marketing-ai/.env",
    };
  }

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) {
    return {
      ok: false,
      configured: true,
      error: me.description || "Invalid bot token",
      fix: "Create a bot via @BotFather and update TELEGRAM_BOT_TOKEN",
    };
  }

  const chatRes = await fetch(
    `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,
  );
  const chat = await chatRes.json();
  if (!chat.ok) {
    return {
      ok: false,
      configured: true,
      bot: `@${me.result.username}`,
      chatId,
      error: chat.description || "Cannot reach chat",
      fix:
        "Use @channelname or -100… id. Run npm run telegram:chats after /start. Channel ids must start with -100.",
    };
  }

  const memberRes = await fetch(
    `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${me.result.id}`,
  );
  const member = await memberRes.json();
  const status = member.result?.status;
  const canPost =
    member.ok &&
    (status === "administrator" || status === "creator" || chat.result.type === "private");

  if (!canPost) {
    return {
      ok: false,
      configured: true,
      bot: `@${me.result.username}`,
      chat: chat.result.title || chat.result.username || chatId,
      chatType: chat.result.type,
      error:
        status === "left" || status === "kicked"
          ? "Bot is not in this channel"
          : "Bot cannot post — add as channel administrator",
      fix: `In Telegram: SyNexus Official → Manage → Administrators → Add @${me.result.username} with Post Messages permission`,
    };
  }

  if (testPost) {
    try {
      await postTelegram(
        "**Synexus test** — platform check OK. Daily campaign posts will appear here.",
        { quiet: true },
      );
    } catch (err) {
      return {
        ok: false,
        configured: true,
        bot: `@${me.result.username}`,
        chat: chat.result.title || chat.result.username,
        error: err.message,
        fix: "Bot may lack permission to post in this chat/channel",
      };
    }
  }

  return {
    ok: true,
    configured: true,
    bot: `@${me.result.username}`,
    chat: chat.result.title || chat.result.username || chatId,
    chatType: chat.result.type,
  };
}

async function checkReddit() {
  if (!hasRedditConfig()) {
    return {
      ok: false,
      configured: false,
      fix: "Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN, REDDIT_SUBREDDIT — then npm run reddit:auth",
    };
  }

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.REDDIT_REFRESH_TOKEN.trim(),
    });
    const clientId = process.env.REDDIT_CLIENT_ID.trim();
    const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim() || "";
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": process.env.REDDIT_USER_AGENT?.trim() || "SynexusPlatformCheck/1.0",
      },
      body,
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error || data.message || "Token refresh failed");
    }
    return {
      ok: true,
      configured: true,
      subreddit: process.env.REDDIT_SUBREDDIT,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err.message,
      fix: "Run npm run reddit:auth",
    };
  }
}

async function checkTikTok() {
  const dayDir = join(__dirname, "output", todayDirName());
  const videoPath = join(dayDir, "synexus-daily.mp4");
  const tiktokPath = join(dayDir, "synexus-tiktok.mp4");
  const hasVideo = await fileExists(videoPath);
  const hasTikTokCopy = await fileExists(tiktokPath);
  const api = hasTikTokApiConfig();
  const postsPerDay = tiktokPostsPerDay();
  const hours = process.env.TIKTOK_POST_HOURS?.trim() || "9,14,20";

  if (api) {
    const result = await checkTikTokApi();
    return {
      ...result,
      mode: `API · ${postsPerDay} posts/day at ${hours}`,
      exportReady: hasVideo,
      tiktokCopy: hasTikTokCopy,
      fix: result.ok ? undefined : result.fix,
    };
  }

  return {
    ok: hasVideo,
    configured: false,
    mode: `Export bundle · ${postsPerDay} captions/day (manual upload)`,
    exportReady: hasVideo,
    tiktokCopy: hasTikTokCopy,
    fix: "Run npm run tiktok:auth — then npm run tiktok:watch for 2–3 auto-posts daily",
  };
}

function printReport(report) {
  console.log("\nSynexus platform check");
  console.log("═".repeat(48));

  console.log("\nConfig (marketing-ai/.env):");
  console.log(`  YOUTUBE_*        ${mask(process.env.YOUTUBE_REFRESH_TOKEN)}`);
  console.log(`  TELEGRAM_BOT     ${mask(process.env.TELEGRAM_BOT_TOKEN)}`);
  console.log(`  TELEGRAM_CHAT_ID ${process.env.TELEGRAM_CHAT_ID?.trim() || "(default @thesynexusofficial)"}`);
  console.log(`  REDDIT_*         ${hasRedditConfig() ? "complete" : "incomplete"}`);
  console.log(`  TIKTOK_*           ${hasTikTokApiConfig() ? "complete" : "incomplete"}`);
  console.log(`  TIKTOK_POSTS/DAY ${tiktokPostsPerDay()} at ${process.env.TIKTOK_POST_HOURS?.trim() || "9,14,20"}`);

  for (const [name, result] of Object.entries(report)) {
    console.log(`\n${icon(result.ok)} ${name.toUpperCase()}`);
    if (result.mode) console.log(`    Mode: ${result.mode}`);
    if (result.bot) console.log(`    Bot: ${result.bot}`);
    if (result.chat) console.log(`    Chat: ${result.chat}${result.chatType ? ` (${result.chatType})` : ""}`);
    if (result.subreddit) console.log(`    Subreddit: r/${result.subreddit.replace(/^r\//i, "")}`);
    if (result.creator) console.log(`    Creator: @${result.creator}`);
    if (result.privacyOptions) console.log(`    Privacy options: ${result.privacyOptions.join(", ")}`);
    if (result.note) console.log(`    ${result.note}`);
    if (result.todayUpload) console.log(`    Today: ${result.todayUpload}`);
    if (result.exportReady != null) {
      console.log(`    Video ready: ${result.exportReady ? "yes" : "no — run npm run video:force"}`);
      if (result.tiktokCopy) console.log(`    TikTok copy: output/.../synexus-tiktok.mp4`);
    }
    if (result.error) console.log(`    Error: ${result.error}`);
    if (result.fix) console.log(`    Fix: ${result.fix}`);
  }

  const allOk =
    report.youtube.ok &&
    report.telegram.ok &&
    report.reddit.ok &&
    (report.tiktok.ok === true || report.tiktok.exportReady);

  console.log("\n" + "─".repeat(48));
  if (allOk) {
    console.log("All requested platforms are connected.");
  } else {
    console.log("Some platforms need attention — see Fix lines above.");
  }
  console.log("");
}

export async function runPlatformCheck({ testPost = false } = {}) {
  const report = {
    youtube: await checkYouTube(),
    telegram: await checkTelegram({ testPost }),
    reddit: await checkReddit(),
    tiktok: await checkTikTok(),
  };
  printReport(report);
  return report;
}

const isMain =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, "/") ||
    process.argv[1].endsWith("platformCheck.js"));

if (isMain) {
  const { testPost } = parseArgs(process.argv.slice(2));
  runPlatformCheck({ testPost: Boolean(testPost) }).catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}
