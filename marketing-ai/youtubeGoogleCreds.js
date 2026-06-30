/** Resolve Google OAuth creds from env and optional google-oauth.json (Google Cloud download). */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OAUTH_JSON = join(__dirname, "google-oauth.json");

function readOAuthJson() {
  if (!existsSync(OAUTH_JSON)) return null;
  try {
    const raw = readFileSync(OAUTH_JSON, "utf8").trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickFromJson(json) {
  const block = json?.web || json?.installed || json;
  if (!block?.client_id || !block?.client_secret) return null;
  const redirect =
    block.redirect_uris?.[0] ||
    json?.redirect_uris?.[0] ||
    "http://localhost:8080/oauth2callback";
  return {
    clientId: String(block.client_id).trim(),
    clientSecret: String(block.client_secret).trim(),
    redirectUri: redirect.trim(),
  };
}

export function getYouTubeGoogleCreds() {
  const fromJson = pickFromJson(readOAuthJson());
  const clientId =
    process.env.YOUTUBE_CLIENT_ID?.trim() ||
    process.env.CLIENT_ID?.trim() ||
    fromJson?.clientId ||
    "";
  const clientSecret =
    process.env.YOUTUBE_CLIENT_SECRET?.trim() ||
    process.env.CLIENT_SECRET?.trim() ||
    fromJson?.clientSecret ||
    "";
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI?.trim() ||
    fromJson?.redirectUri ||
    "http://localhost:8080/oauth2callback";

  return { clientId, clientSecret, redirectUri };
}

export function hasYouTubeGoogleCreds(creds = getYouTubeGoogleCreds()) {
  return Boolean(creds.clientId && creds.clientSecret);
}

export function youtubeOAuthJsonPath() {
  return OAUTH_JSON;
}
