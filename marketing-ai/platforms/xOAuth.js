import crypto from "node:crypto";

const enc = (value) =>
  encodeURIComponent(String(value))
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");

export function getXCreds() {
  return {
    consumerKey: process.env.X_API_KEY?.trim() || "",
    consumerSecret: process.env.X_API_SECRET?.trim() || "",
    accessToken: process.env.X_ACCESS_TOKEN?.trim() || "",
    accessSecret: process.env.X_ACCESS_SECRET?.trim() || "",
  };
}

export function hasXCreds(creds = getXCreds()) {
  return Boolean(creds.consumerKey && creds.consumerSecret && creds.accessToken && creds.accessSecret);
}

export function oauthAuthHeader(method, url, params, creds) {
  const oauthParams = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...params, ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${enc(key)}=${enc(allParams[key])}`)
    .join("&");
  const baseString = `${method.toUpperCase()}&${enc(url)}&${enc(paramString)}`;
  const signingKey = `${enc(creds.consumerSecret)}&${enc(creds.accessSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  oauthParams.oauth_signature = signature;

  return (
    "OAuth " +
    Object.entries(oauthParams)
      .map(([key, value]) => `${enc(key)}="${enc(value)}"`)
      .join(", ")
  );
}

function buildUrl(base, params = {}) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function parseXResponse(res) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

export async function oauthFormPost(url, fields, creds) {
  const body = new URLSearchParams(fields).toString();
  const auth = oauthAuthHeader("POST", url, Object.fromEntries(new URLSearchParams(body)), creds);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return parseXResponse(res);
}

export async function oauthGet(baseUrl, params, creds) {
  const url = buildUrl(baseUrl, params);
  const auth = oauthAuthHeader("GET", baseUrl, params, creds);
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: auth },
  });
  return parseXResponse(res);
}

export async function oauthJsonPost(url, payload, creds) {
  const auth = oauthAuthHeader("POST", url, {}, creds);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseXResponse(res);
}

export async function oauthMultipartPost(url, signParams, formData, creds) {
  const auth = oauthAuthHeader("POST", url, signParams, creds);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth },
    body: formData,
  });
  return parseXResponse(res);
}

/** OAuth 1.0a request token flow (no user token yet). */
export async function oauthRequestTokenPost(url, body, consumerKey, consumerSecret, token = "", tokenSecret = "") {
  const extraParams = Object.fromEntries(new URLSearchParams(body));
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
  const baseString = `POST&${enc(url)}&${enc(paramString)}`;
  const signingKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const header =
    "OAuth " +
    Object.entries(oauthParams)
      .map(([key, value]) => `${enc(key)}="${enc(value)}"`)
      .join(", ");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: header,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`X OAuth failed (${res.status}): ${text.slice(0, 300)}`);
  return Object.fromEntries(new URLSearchParams(text));
}
