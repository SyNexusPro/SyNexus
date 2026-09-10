#!/usr/bin/env node
/**
 * TikTok OAuth for Content Posting API (video.publish).
 *
 * Prerequisites (developers.tiktok.com):
 *   1. Create app → add Login Kit + Content Posting API
 *   2. Enable Direct Post
 *   3. Register redirect URI (must be https — use ngrok for local auth)
 *   4. Request video.publish scope approval
 *
 *   npm run tiktok:auth
 */

import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, ".env");
const SCOPES = ["user.info.basic", "video.publish"].join(",");

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

function parseCode(raw) {
  const trimmed = raw.trim();
  const match = trimmed.match(/[?&]code=([^&]+)/);
  if (match) return decodeURIComponent(match[1]);
  return trimmed.replace(/^code=/, "");
}

async function main() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() || process.env.TIKTOK_CLIENT_ID?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();

  if (!clientKey || !clientSecret) {
    console.error(`
Set in marketing-ai/.env first:
  TIKTOK_CLIENT_KEY=     (from TikTok Developer Portal → your app)
  TIKTOK_CLIENT_SECRET=
  TIKTOK_REDIRECT_URI=   (must be https, registered in Login Kit)

For local auth, use ngrok:
  ngrok http 8080
  Set TIKTOK_REDIRECT_URI=https://YOUR-ID.ngrok-free.app/callback
`);
    process.exit(1);
  }

  if (!redirectUri?.startsWith("https://")) {
    console.error("TIKTOK_REDIRECT_URI must start with https:// (TikTok requirement).");
    console.error("Use ngrok or a deployed callback URL.");
    process.exit(1);
  }

  const state = `synexus_${Date.now()}`;
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });

  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

  console.log("\nAuthorize SyNexus TikTok posting (video.publish):\n");
  console.log(url);
  console.log("\nAfter allowing, paste the full redirect URL or the code.\n");

  const rl = createInterface({ input, output });
  const raw = (await rl.question("Redirect URL or code: ")).trim();
  rl.close();

  const code = parseCode(raw);
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    console.error(data.error_description || data.error || "Token exchange failed");
    process.exit(1);
  }

  await upsertEnv("TIKTOK_ACCESS_TOKEN", data.access_token);
  if (data.refresh_token) await upsertEnv("TIKTOK_REFRESH_TOKEN", data.refresh_token);
  if (data.open_id) await upsertEnv("TIKTOK_OPEN_ID", data.open_id);

  console.log("\n✓ Saved TikTok tokens to marketing-ai/.env");
  console.log(`  Scopes: ${data.scope || SCOPES}`);
  console.log("\nNext:");
  console.log("  npm run platform:check     — verify connection");
  console.log("  npm run tiktok:watch       — auto-post 2–3× daily");
  console.log("  npm run campaign:daily     — render + post all platforms");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
