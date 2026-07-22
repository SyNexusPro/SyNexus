#!/usr/bin/env node
/**
 * Meta (Facebook + Instagram) OAuth — Page token + IG Business ID.
 *
 *   npm run meta:auth
 *
 * Prerequisites:
 *   1. developers.facebook.com → Create app (Business type)
 *   2. Add Facebook Login + Instagram Graph API products
 *   3. Connect a Facebook Page + Instagram Business/Creator account
 *   4. Set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI in .env
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
const SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

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
  const match = trimmed.match(/[?&#]code=([^&]+)/);
  if (match) return decodeURIComponent(match[1]);
  return trimmed.replace(/^code=/, "");
}

async function main() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim() || "https://localhost/";

  if (!appId || !appSecret) {
    console.error(`
Set in marketing-ai/.env:
  META_APP_ID=
  META_APP_SECRET=
  META_REDIRECT_URI=https://localhost/   (must match Meta app OAuth settings)

Quick path: Graph API Explorer → generate Page token with pages_manage_posts
  → paste as META_PAGE_ACCESS_TOKEN + META_PAGE_ID manually
`);
    process.exit(1);
  }

  const url =
    `https://www.facebook.com/v21.0/dialog/oauth?` +
    new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      response_type: "code",
    }).toString();

  console.log("\nAuthorize SyNexus for Facebook Page + Instagram Reels:\n");
  console.log(url);
  console.log("\nPaste redirect URL or code after allowing.\n");

  const rl = createInterface({ input, output });
  const raw = (await rl.question("Redirect URL or code: ")).trim();
  rl.close();

  const code = parseCode(raw);
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
  );
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error(tokenData.error?.message || "Token exchange failed");
    process.exit(1);
  }

  let userToken = tokenData.access_token;

  const longRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: userToken,
      }),
  );
  const longData = await longRes.json();
  if (longData.access_token) userToken = longData.access_token;

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(userToken)}`,
  );
  const pagesData = await pagesRes.json();
  const pages = pagesData.data || [];

  if (!pages.length) {
    console.error("No Facebook Pages found. Create a Page and grant access to this app.");
    process.exit(1);
  }

  console.log("\nPages you manage:");
  pages.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.id})`));

  const rl2 = createInterface({ input, output });
  const pick = (await rl2.question(`Pick page number [1]: `)).trim() || "1";
  rl2.close();

  const page = pages[Math.max(0, Number(pick) - 1)] || pages[0];
  await upsertEnv("META_PAGE_ID", page.id);
  await upsertEnv("META_PAGE_ACCESS_TOKEN", page.access_token);

  const igRes = await fetch(
    `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token)}`,
  );
  const igData = await igRes.json();
  const igId = igData.instagram_business_account?.id;

  if (igId) {
    await upsertEnv("META_IG_USER_ID", igId);
    console.log(`\n✓ Saved META_PAGE_ID, META_PAGE_ACCESS_TOKEN, META_IG_USER_ID=${igId}`);
  } else {
    console.log("\n✓ Saved META_PAGE_ID + META_PAGE_ACCESS_TOKEN");
    console.log("  Link Instagram Business to this Page in Meta Business Suite for Reels auto-post.");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
