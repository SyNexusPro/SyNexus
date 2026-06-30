#!/usr/bin/env node
/**
 * Verify YouTube Data API v3 OAuth (refresh token + channel access).
 *
 *   npm run youtube:oauth:verify
 */

import { loadMarketingEnv } from "./loadEnv.js";
import { hasYouTubeCredentials, getYouTubeClient, YOUTUBE_OAUTH_SCOPES } from "./youtubeUpload.js";
import { getYouTubeGoogleCreds, hasYouTubeGoogleCreds } from "./youtubeGoogleCreds.js";

loadMarketingEnv();

const creds = getYouTubeGoogleCreds();

console.log("\nYouTube OAuth status\n");
console.log(`  Client ID:     ${creds.clientId ? `${creds.clientId.slice(0, 20)}…` : "missing"}`);
console.log(`  Client secret: ${creds.clientSecret ? "set" : "missing"}`);
console.log(`  Redirect URI:  ${creds.redirectUri}`);
console.log(`  Refresh token: ${process.env.YOUTUBE_REFRESH_TOKEN?.trim() ? "set" : "missing"}`);

if (!hasYouTubeGoogleCreds()) {
  console.error("\n✗ Add YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET to marketing-ai/.env");
  console.error("  Or paste Google Cloud JSON into marketing-ai/google-oauth.json");
  console.error("  Then run: npm run youtube:oauth\n");
  process.exit(1);
}

if (!hasYouTubeCredentials()) {
  console.error("\n✗ No refresh token yet. Run: npm run youtube:oauth\n");
  process.exit(1);
}

try {
  const youtube = await getYouTubeClient();
  const res = await youtube.channels.list({ part: ["snippet"], mine: true });
  const ch = res.data.items?.[0];
  if (!ch) {
    console.error("\n✗ Token valid but no YouTube channel on this Google account.\n");
    process.exit(1);
  }
  console.log(`\n✓ Connected · channel "${ch.snippet?.title}" (${ch.id})`);
  console.log("  YouTube Data API v3 upload scope is ready.");
  console.log("  Run: npm run youtube:test  or  npm run youtube:daily\n");
} catch (err) {
  const data = err?.response?.data?.error;
  const reason = data?.errors?.[0]?.reason || "";
  const msg = data?.message || err.message || String(err);

  if (reason === "youtubeSignupRequired") {
    console.error("\n✗ This Google account has no YouTube channel yet.");
    console.error("  1. Open https://www.youtube.com and sign in with the SAME Google account");
    console.error("  2. Create a channel (profile icon → Create a channel)");
    console.error("  3. Run: npm run youtube:test\n");
    process.exit(1);
  }

  console.error(`\n✗ Verify failed: ${msg}`);
  if (msg.includes("invalid_grant") || msg.includes("insufficient")) {
    console.error("  Re-auth: npm run youtube:oauth\n");
  }
  process.exit(1);
}
