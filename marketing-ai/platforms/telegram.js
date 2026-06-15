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

export async function postTelegram(message, { quiet = false } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "@thesynexusofficial";
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN not set in marketing-ai/.env");
  }

  const url = `${API}/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: toTelegramHtml(message),
    parse_mode: "HTML",
    disable_web_page_preview: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `Telegram API error (${res.status})`);
  }

  if (!quiet) console.log("✓ Posted to Telegram");
  return { messageId: data.result?.message_id, chatId };
}
