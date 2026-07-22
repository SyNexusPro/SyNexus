#!/usr/bin/env node
/**
 * X (Twitter) OAuth 1.0a — get user Access Token + Secret for posting.
 *
 * Prerequisites (developer.x.com → your app):
 *   · App permissions: Read and write
 *   · User authentication: OAuth 1.0a enabled
 *   · X_API_KEY + X_API_SECRET in marketing-ai/.env
 *
 *   npm run x:auth
 */

import crypto from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, ".env");
const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize";
const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";

function enc(value) {
  return encodeURIComponent(String(value))
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function parseFormBody(text) {
  return Object.fromEntries(new URLSearchParams(text));
}

function oauthAuthorizationHeader(method, url, extraParams, consumerKey, consumerSecret, token = "", tokenSecret = "") {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  if (token) oauthParams.oauth_token = token;

  const allParams = { ...extraParams, ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${enc(key)}=${enc(allParams[key])}`)
    .join("&");
  const baseString = `${method.toUpperCase()}&${enc(url)}&${enc(paramString)}`;
  const signingKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  oauthParams.oauth_signature = signature;

  const header =
    "OAuth " +
    Object.entries(oauthParams)
      .map(([key, value]) => `${enc(key)}="${enc(value)}"`)
      .join(", ");

  return header;
}

async function oauthFetch(method, url, { consumerKey, consumerSecret, token = "", tokenSecret = "", body = null } = {}) {
  const extraParams = body ? parseFormBody(body) : {};
  const auth = oauthAuthorizationHeader(method, url, extraParams, consumerKey, consumerSecret, token, tokenSecret);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: auth,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body || undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`X OAuth failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return parseFormBody(text);
}

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

async function main() {
  const consumerKey = process.env.X_API_KEY?.trim();
  const consumerSecret = process.env.X_API_SECRET?.trim();

  if (!consumerKey || !consumerSecret) {
    console.error(`
Set in marketing-ai/.env first:
  X_API_KEY=       (Consumer / API key)
  X_API_SECRET=    (Consumer / API secret)

Then run: npm run x:auth
`);
    process.exit(1);
  }

  console.log("\nStep 1 — request token…");
  const requestToken = await oauthFetch("POST", REQUEST_TOKEN_URL, {
    consumerKey,
    consumerSecret,
    body: "oauth_callback=oob",
  });

  if (!requestToken.oauth_token) {
    throw new Error("Missing oauth_token — check app permissions (Read and write) and OAuth 1.0a settings");
  }

  const authUrl = `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(requestToken.oauth_token)}`;
  console.log("\nStep 2 — open this URL and authorize SyNexus:\n");
  console.log(authUrl);
  console.log("\nAfter approving, copy the 7-digit PIN shown on X.\n");

  const rl = createInterface({ input, output });
  const pin = (await rl.question("PIN: ")).trim();
  rl.close();

  console.log("\nStep 3 — exchange for access token…");
  const access = await oauthFetch("POST", ACCESS_TOKEN_URL, {
    consumerKey,
    consumerSecret,
    token: requestToken.oauth_token,
    tokenSecret: requestToken.oauth_token_secret,
    body: `oauth_verifier=${encodeURIComponent(pin)}`,
  });

  if (!access.oauth_token || !access.oauth_token_secret) {
    throw new Error("Access token exchange failed — wrong PIN or app settings");
  }

  await upsertEnv("X_ACCESS_TOKEN", access.oauth_token);
  await upsertEnv("X_ACCESS_SECRET", access.oauth_token_secret);

  console.log("\n✓ Saved X user tokens to marketing-ai/.env");
  if (access.screen_name) console.log(`  Account: @${access.screen_name}`);
  console.log("\nIMPORTANT: App permissions must be Read and write (developer.x.com).");
  console.log("If you change permissions, regenerate tokens and run npm run x:auth again.");
  console.log("\nNext:");
  console.log("  npm run x:check");
  console.log("  npm run launch:blast -- --day 1 --slot 0");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
