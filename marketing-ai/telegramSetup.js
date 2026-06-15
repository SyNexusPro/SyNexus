#!/usr/bin/env node
/** Print recent Telegram chat IDs — message your bot first, then run this. */

import { loadMarketingEnv } from "./loadEnv.js";

loadMarketingEnv();

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN in marketing-ai/.env");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = await res.json();

if (!data.ok) {
  console.error(data.description || "getUpdates failed");
  process.exit(1);
}

if (!data.result?.length) {
  console.log("No messages yet. Open Telegram, find your bot, send /start, then run this again.");
  process.exit(0);
}

console.log("\nRecent chats (use id as TELEGRAM_CHAT_ID):\n");
const seen = new Set();
for (const update of data.result) {
  const chat = update.message?.chat || update.channel_post?.chat;
  if (!chat || seen.has(chat.id)) continue;
  seen.add(chat.id);
  const label = chat.title || chat.username || chat.first_name || "chat";
  console.log(`  ${label} → ${chat.id}${chat.username ? ` (@${chat.username})` : ""}`);
}

console.log("\nFor a public channel, add the bot as admin and use @channelname or the numeric id.");
