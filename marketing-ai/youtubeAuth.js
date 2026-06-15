#!/usr/bin/env node
/**
 * YouTube OAuth for daily uploads.
 *
 *   npm run youtube:auth              # print URL + prompt for code
 *   npm run youtube:auth -- --url     # print URL only
 *   npm run youtube:auth -- --code XXX
 */

import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { loadMarketingEnv } from "./loadEnv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, ".env");
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

loadMarketingEnv();

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
  await writeFile(ENV_PATH, next.startsWith("\n") ? next.trimStart() : next, "utf8");
}

function parseCodeArg(argv) {
  const flag = argv.find((a) => a.startsWith("--code="));
  if (flag) return flag.slice("--code=".length).trim();
  const idx = argv.indexOf("--code");
  if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith("--")) {
    return argv[idx + 1].trim();
  }
  return "";
}

function buildOAuth() {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI?.trim() || "http://localhost";

  if (!clientId || !clientSecret) {
    throw new Error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in marketing-ai/.env first.");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
  });

  return { oauth2, url };
}

async function exchangeCode(oauth2, code) {
  const cleaned = code.replace(/^code=/, "").trim();
  const { tokens } = await oauth2.getToken(cleaned);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Revoke Synexus in Google Account → Security → Third-party access, then run auth again.",
    );
  }
  await upsertEnv("YOUTUBE_REFRESH_TOKEN", tokens.refresh_token);
  console.log("\n✓ Saved YOUTUBE_REFRESH_TOKEN to marketing-ai/.env");
}

async function main() {
  const argv = process.argv.slice(2);
  const urlOnly = argv.includes("--url") || argv.includes("--url-only");
  const codeArg = parseCodeArg(argv);
  const { oauth2, url } = buildOAuth();

  if (codeArg) {
    await exchangeCode(oauth2, codeArg);
    console.log("Run: npm run youtube:daily");
    return;
  }

  console.log("\nAuthorize Synexus YouTube upload:\n");
  console.log(url);
  console.log("\nAfter approving, copy the `code=` value from the browser redirect URL.");
  console.log("Then run: npm run youtube:auth -- --code YOUR_CODE_HERE\n");

  if (urlOnly) return;

  const rl = createInterface({ input, output });
  const code = (await rl.question("Code (or full redirect URL): ")).trim();
  rl.close();

  const match = code.match(/[?&]code=([^&]+)/);
  await exchangeCode(oauth2, match ? decodeURIComponent(match[1]) : code);
  console.log("Run: npm run youtube:daily");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
