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

  const bunnyPath =
    photoPath ||
    (process.env.TELEGRAM_BUNNY_PHOTO !== "0" ? getSynBunnyPngPath() : null);

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
