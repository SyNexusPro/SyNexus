import { parseRedditPost } from "../synexusMarketingBot.js";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";

export function hasRedditConfig() {
  return Boolean(
    process.env.REDDIT_CLIENT_ID?.trim() &&
      process.env.REDDIT_REFRESH_TOKEN?.trim() &&
      process.env.REDDIT_SUBREDDIT?.trim(),
  );
}

function userAgent() {
  return process.env.REDDIT_USER_AGENT?.trim() || "SynexusDailyBot/1.0 by synexus";
}

function basicAuth() {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim() || "";
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function getAccessToken() {
  const refreshToken = process.env.REDDIT_REFRESH_TOKEN?.trim();
  if (!refreshToken) throw new Error("REDDIT_REFRESH_TOKEN not set");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || data.message || "Reddit token refresh failed — run npm run reddit:auth");
  }
  return data.access_token;
}

function markdownToPlain(text) {
  return String(text).replace(/\*\*(.+?)\*\*/g, "$1");
}

export async function postReddit(redditPackText, { quiet = false } = {}) {
  const subreddit = process.env.REDDIT_SUBREDDIT?.trim();
  if (!subreddit) throw new Error("REDDIT_SUBREDDIT not set (e.g. your username for profile posts: u_you)");

  const { title, body } = parseRedditPost(redditPackText);
  const accessToken = await getAccessToken();

  const sr = subreddit.replace(/^r\//i, "").replace(/^u\//i, "");
  const isProfile = subreddit.toLowerCase().startsWith("u/") || process.env.REDDIT_POST_TO_PROFILE === "1";

  const params = new URLSearchParams({
    api_type: "json",
    kind: "self",
    sr: isProfile ? `u_${sr.replace(/^u_/, "")}` : sr,
    title: title.slice(0, 300),
    text: markdownToPlain(body).slice(0, 40000),
    nsfw: "false",
    sendreplies: "true",
  });

  const res = await fetch(`${API}/api/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: params,
  });

  const data = await res.json().catch(() => ({}));
  const errors = data.json?.errors;
  if (!res.ok || (errors && errors.length)) {
    const msg = errors?.[0]?.join?.(" ") || data.message || `Reddit submit failed (${res.status})`;
    throw new Error(msg);
  }

  const postUrl = data.json?.data?.url;
  if (!quiet) console.log(`✓ Posted to Reddit${postUrl ? `: ${postUrl}` : ""}`);
  return { url: postUrl, id: data.json?.data?.id, subreddit: sr };
}
