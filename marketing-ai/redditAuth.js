#!/usr/bin/env node
/**
 * Reddit OAuth (script / installed app).
 *
 *   npm run reddit:auth
 *   Open URL → allow → paste redirect URL or code
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
  return trimmed;
}

async function main() {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const redirectUri = process.env.REDDIT_REDIRECT_URI?.trim() || "http://localhost:8080";
  if (!clientId) {
    console.error("Set REDDIT_CLIENT_ID in marketing-ai/.env (create app at reddit.com/prefs/apps)");
    process.exit(1);
  }

  const state = `synexus_${Date.now()}`;
  const scopes = ["submit", "identity"].join(" ");
  const url =
    `https://www.reddit.com/api/v1/authorize?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&duration=permanent&scope=${encodeURIComponent(scopes)}`;

  console.log("\nAuthorize Synexus Reddit posting:\n");
  console.log(url);
  console.log("\nAfter allowing, paste the full redirect URL or the code.\n");

  const rl = createInterface({ input, output });
  const raw = (await rl.question("Redirect URL or code: ")).trim();
  rl.close();

  const code = parseCode(raw);
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim() || "";
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "SynexusAuth/1.0",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.refresh_token) {
    console.error(data.error || data.message || "Token exchange failed");
    process.exit(1);
  }

  await upsertEnv("REDDIT_REFRESH_TOKEN", data.refresh_token);
  console.log("\n✓ Saved REDDIT_REFRESH_TOKEN");
  console.log("Set REDDIT_SUBREDDIT (e.g. YourSubName or u_YourUsername for profile)");
  console.log("Run: npm run campaign:daily");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
