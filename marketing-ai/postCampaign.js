require("dotenv").config();
const axios = require("axios");

async function postToTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "@thesynexusofficial";

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await axios.post(url, {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
  });

  console.log("✅ Posted to Telegram");
}

async function main() {
  const message = `
🚀 <b>SyNexus Official</b>

AI-powered Solana intelligence is coming.

✅ Token risk scans
✅ Sentinel alerts
✅ Scam detection
✅ Market intelligence
✅ SYN Coin ecosystem

Enter the SyNexus.
`;

  await postToTelegram(message);
}

main().catch((err) => {
  console.error("❌ Error:", err.response?.data || err.message);
}); 