#!/usr/bin/env node
/**
 * YouTube OAuth for daily uploads.
 *
 *   npm run youtube:auth:callback   # local server — open browser, auto-save token
 *   npm run youtube:auth            # manual code paste (legacy)
 *   npm run youtube:auth -- --url   # print auth URL only
 *   npm run youtube:auth -- --code XXX
 */

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { loadMarketingEnv } from "./loadEnv.js";
import { getYouTubeGoogleCreds, hasYouTubeGoogleCreds } from "./youtubeGoogleCreds.js";
import { YOUTUBE_OAUTH_SCOPES } from "./youtubeUpload.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, ".env");
const SCOPE = YOUTUBE_OAUTH_SCOPES;
const DEFAULT_PORT = 8080;

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

function parsePort(argv) {
  const flag = argv.find((a) => a.startsWith("--port="));
  if (flag) return Number(flag.split("=")[1]);
  const idx = argv.indexOf("--port");
  if (idx !== -1 && argv[idx + 1]) return Number(argv[idx + 1]);
  return Number(process.env.YOUTUBE_OAUTH_PORT || DEFAULT_PORT);
}

function buildOAuth(redirectUriOverride = null) {
  const { clientId, clientSecret, redirectUri } = getYouTubeGoogleCreds();
  const redirect = redirectUriOverride || redirectUri;

  if (!hasYouTubeGoogleCreds({ clientId, clientSecret, redirectUri: redirect })) {
    throw new Error(
      "Set YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET (or CLIENT_ID + CLIENT_SECRET) in marketing-ai/.env",
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirect);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPE,
  });

  return { oauth2, url, redirectUri: redirect };
}

async function exchangeCode(oauth2, code, redirectUriUsed) {
  const cleaned = code.replace(/^code=/, "").trim();
  const { tokens } = await oauth2.getToken(cleaned);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Revoke SyNexus in Google Account → Security → Third-party access, then run auth again.",
    );
  }

  const { clientId, clientSecret } = getYouTubeGoogleCreds();
  const redirectUri = redirectUriUsed || getYouTubeGoogleCreds().redirectUri;
  await upsertEnv("YOUTUBE_CLIENT_ID", clientId);
  await upsertEnv("YOUTUBE_CLIENT_SECRET", clientSecret);
  await upsertEnv("YOUTUBE_REDIRECT_URI", redirectUri);
  await upsertEnv("YOUTUBE_REFRESH_TOKEN", tokens.refresh_token);
  console.log("\n✓ Saved YouTube OAuth to marketing-ai/.env");
  console.log("  YOUTUBE_CLIENT_ID");
  console.log("  YOUTUBE_CLIENT_SECRET");
  console.log("  YOUTUBE_REDIRECT_URI");
  console.log("  YOUTUBE_REFRESH_TOKEN");
}

function successHtml() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SyNexus · YouTube connected</title>
<style>body{font-family:system-ui;background:#0a0a0f;color:#e8e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:420px;padding:2rem;border:1px solid #7c3aed55;border-radius:16px;background:#12121a;text-align:center}
h1{color:#a855f7;font-size:1.4rem}p{color:#aaa;line-height:1.5}</style></head>
<body><div class="card"><h1>YouTube connected</h1>
<p>SyNexus saved your refresh token. You can close this tab and return to the terminal.</p>
<p>Run: <code>npm run youtube:daily</code> or <code>npm run hype:post -- --force</code></p>
</div></body></html>`;
}

function errorHtml(message) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SyNexus · Auth failed</title></head>
<body style="font-family:system-ui;background:#1a0a0a;color:#fcc;padding:2rem">
<h1>YouTube auth failed</h1><pre>${message}</pre>
<p>Close this tab and check the terminal.</p></body></html>`;
}

async function runCallbackServer(argv) {
  const port = parsePort(argv);
  const autoUpload = argv.includes("--upload") || argv.includes("--test");
  const redirectUri = `http://localhost:${port}/oauth2callback`;
  const { oauth2, url } = buildOAuth(redirectUri);

  console.log("\nSynexus YouTube OAuth — local callback server\n");
  console.log("Add this redirect URI in Google Cloud Console → Credentials → your OAuth client:");
  console.log(`  ${redirectUri}\n`);
  console.log("Opening browser…\n");
  console.log(url);
  console.log("");

  let settled = false;

  const server = createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || "/", `http://localhost:${port}`);
      if (reqUrl.pathname !== "/oauth2callback") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      const err = reqUrl.searchParams.get("error");
      if (err) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorHtml(err));
        throw new Error(`Google OAuth error: ${err}`);
      }

      const code = reqUrl.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorHtml("Missing code parameter"));
        return;
      }

      await exchangeCode(oauth2, code, redirectUri);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successHtml());

      if (!settled) {
        settled = true;
        console.log("✓ Auth complete.");
        if (autoUpload) {
          console.log("\nUploading WHALE ALERT test Short…\n");
          const { spawn } = await import("node:child_process");
          const child = spawn(process.execPath, ["youtubeTestUpload.js"], {
            cwd: __dirname,
            stdio: "inherit",
            shell: false,
          });
          child.on("close", (code) => {
            server.close();
            process.exit(code ?? 0);
          });
        } else {
          console.log("Run: npm run youtube:test");
          setTimeout(() => server.close(), 500);
        }
      }
    } catch (e) {
      if (!settled) {
        settled = true;
        console.error(e.message || e);
        server.close();
        process.exit(1);
      }
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  console.log(`Listening on ${redirectUri}\n`);

  try {
    const open = (await import("open")).default;
    await open(url);
  } catch {
    console.log("Open the URL above in your browser if it did not launch automatically.\n");
  }

  await new Promise((resolve) => {
    server.on("close", resolve);
    setTimeout(() => {
      if (!settled) {
        console.error("\nTimed out waiting for OAuth callback (5 min).");
        server.close();
        process.exit(1);
      }
    }, 5 * 60 * 1000);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const urlOnly = argv.includes("--url") || argv.includes("--url-only");
  const useCallback = argv.includes("--callback") || argv.includes("--server");

  if (useCallback) {
    await runCallbackServer(argv);
    return;
  }

  const codeArg = parseCodeArg(argv);
  const { oauth2, url, redirectUri } = buildOAuth();

  if (codeArg) {
    await exchangeCode(oauth2, codeArg, redirectUri);
    console.log("Run: npm run youtube:oauth:verify");
    return;
  }

  console.log("\nAuthorize SyNexus YouTube upload:\n");
  console.log(url);
  console.log(`\nRedirect URI in use: ${redirectUri}`);
  console.log("\nRecommended: npm run youtube:oauth  (local /oauth2callback server)");
  console.log("Or after approving, copy the `code=` value from the browser redirect URL.");
  console.log("Then run: npm run youtube:auth -- --code YOUR_CODE_HERE\n");

  if (urlOnly) return;

  const rl = createInterface({ input, output });
  const code = (await rl.question("Code (or full redirect URL): ")).trim();
  rl.close();

  const match = code.match(/[?&]code=([^&]+)/);
  await exchangeCode(oauth2, match ? decodeURIComponent(match[1]) : code, redirectUri);
  console.log("Run: npm run youtube:oauth:verify");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
