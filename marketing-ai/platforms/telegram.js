import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getSynBunnyPngPath } from "../synBunny.js";

const API = "https://api.telegram.org";

export function hasTelegramConfig() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

/** Convert **bold** markdown to Telegram HTML. */
export function toTelegramHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

async function sendTelegramPhoto(token, chatId, photoPath, caption, quiet) {
  const buf = await readFile(photoPath);
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", toTelegramHtml(caption));
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([buf], { type: "image/png" }), "syn-bunny.png");

  const res = await fetch(`${API}/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `Telegram sendPhoto failed (${res.status})`);
  }

  if (!quiet) console.log("✓ Posted to Telegram (with Syn bunny)");
  return { messageId: data.result?.message_id, chatId, withPhoto: true };
}

async function sendTelegramMessage(token, chatId, message, quiet) {
  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: toTelegramHtml(message),
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `Telegram API error (${res.status})`);
  }

  if (!quiet) console.log("✓ Posted to Telegram");
  return { messageId: data.result?.message_id, chatId, withPhoto: false };
}

async function sendTelegramVideo(token, chatId, videoPath, caption, quiet) {
  const buf = await readFile(videoPath);
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", toTelegramHtml(caption));
  form.append("parse_mode", "HTML");
  form.append("supports_streaming", "true");
  form.append("video", new Blob([buf], { type: "video/mp4" }), "synexus-daily.mp4");

  const res = await fetch(`${API}/bot${token}/sendVideo`, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `Telegram sendVideo failed (${res.status})`);
  }

  if (!quiet) console.log("✓ Posted video to Telegram");
  return { messageId: data.result?.message_id, chatId, withVideo: true };
}

export async function postTelegram(message, { quiet = false, photoPath, videoPath } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "@thesynexusofficial";
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN not set in marketing-ai/.env");
  }

  if (videoPath && existsSync(videoPath)) {
    try {
      return await sendTelegramVideo(token, chatId, videoPath, message, quiet);
    } catch (err) {
      if (!quiet) {
        console.warn(`Telegram video failed (${err.message}) — falling back to photo/text`);
      }
    }
  }

  if (photoPath && existsSync(photoPath)) {
    try {
      return await sendTelegramPhoto(token, chatId, photoPath, message, quiet);
    } catch (err) {
      if (!quiet) {
        console.warn(`Telegram photo failed (${err.message}) — falling back to text`);
      }
    }
  }

  const bunnyPath =
    process.env.TELEGRAM_BUNNY_PHOTO === "1" ? getSynBunnyPngPath() : null;

  if (bunnyPath && existsSync(bunnyPath)) {
    try {
      return await sendTelegramPhoto(token, chatId, bunnyPath, message, quiet);
    } catch (err) {
      if (!quiet) {
        console.warn(`Telegram photo failed (${err.message}) — falling back to text`);
      }
    }
  }

  return sendTelegramMessage(token, chatId, message, quiet);
}

export async function deleteTelegramMessage(messageId, chatId = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const cid = chatId || process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !cid) throw new Error("Telegram not configured");
  if (!messageId) throw new Error("messageId required");

  const res = await fetch(`${API}/bot${token}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: cid, message_id: Number(messageId) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `Telegram delete failed (${res.status})`);
  }
  return { deleted: true, messageId, chatId: cid };
}

function channelSlugFromEnv() {
  const explicit = process.env.TELEGRAM_CHANNEL_SLUG?.trim();
  if (explicit) return explicit.replace(/^@/, "");
  const url = process.env.TELEGRAM_CHANNEL_URL?.trim() || "";
  const m = url.match(/t\.me\/(?:s\/)?([^/?#]+)/i);
  return (m?.[1] || "thesynexusofficial").replace(/^@/, "");
}

/** Scrape public t.me/s preview for recent message IDs (when IDs weren't saved). */
export async function discoverTelegramMessageIds(channelSlug = null, limit = 20) {
  const slug = (channelSlug || channelSlugFromEnv()).replace(/^@/, "");
  const url = `https://t.me/s/${slug}`;
  const res = await fetch(url, { headers: { "User-Agent": "SynexusRetract/1.0" } });
  if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`);
  const html = await res.text();
  const ids = [];
  const re = /data-post="[^"]+\/(\d+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    ids.push(Number(m[1]));
  }
  const scraped = [...new Set(ids)].sort((a, b) => b - a);
  if (scraped.length >= limit) return scraped.slice(0, limit);

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (token && chatId) {
    const u = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`).then((r) => r.json());
    const fromUpdates = (u.result || [])
      .flatMap((item) => [item.channel_post, item.message].filter(Boolean))
      .filter((msg) => String(msg.chat?.id) === String(chatId))
      .map((msg) => Number(msg.message_id))
      .sort((a, b) => b - a);
    return [...new Set([...scraped, ...fromUpdates])].sort((a, b) => b - a).slice(0, limit);
  }

  return scraped.slice(0, limit);
}

/** Find hype-blast message IDs on the public channel preview (caption marker match). */
export async function discoverHypeTelegramIds({ marker = "Download SyNexus", limit = 15 } = {}) {
  const slug = channelSlugFromEnv();
  const url = `https://t.me/s/${slug}`;
  const res = await fetch(url, { headers: { "User-Agent": "SynexusRetract/1.0" } });
  if (!res.ok) return [];
  const html = await res.text();
  const ids = [];
  for (const block of html.split("tgme_widget_message_wrap")) {
    const idM = block.match(/data-post="[^"]+\/(\d+)"/);
    if (!idM) continue;
    const text = block.replace(/<[^>]+>/g, " ");
    if (text.includes(marker) || text.includes("WHALE ALERT")) {
      ids.push(Number(idM[1]));
    }
  }
  return [...new Set(ids)].sort((a, b) => b - a).slice(0, limit);
}
