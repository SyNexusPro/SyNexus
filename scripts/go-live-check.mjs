#!/usr/bin/env node
/**
 * SyNexus go-live readiness report (local — does not hit production).
 *   npm run go-live:check
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const marketing = join(root, "marketing-ai");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function hasKey(env, key) {
  const v = env[key];
  return Boolean(v && v.length > 0 && !v.startsWith("your_"));
}

function status(ok, label, detail = "") {
  const icon = ok ? "✓" : "✗";
  console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function section(title) {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

const rootEnv = readEnvFile(join(root, ".env"));
const mEnv = readEnvFile(join(marketing, ".env"));
const mergedApp = { ...rootEnv, ...mEnv };

let pass = 0;
let fail = 0;

function check(ok) {
  if (ok) pass += 1;
  else fail += 1;
  return ok;
}

section("Web app (synexus.pro)");
check(status(hasKey(mergedApp, "VITE_SUPABASE_URL") || hasKey(mergedApp, "SUPABASE_URL"), "Supabase URL"));
check(
  status(
    hasKey(mergedApp, "VITE_SUPABASE_ANON_KEY") || hasKey(mergedApp, "SUPABASE_ANON_KEY"),
    "Supabase anon key",
  ),
);
check(status(hasKey(mergedApp, "SUPABASE_SERVICE_ROLE_KEY"), "Service role (analytics API)", "Vercel server env"));
check(status(hasKey(mergedApp, "VITE_APP_ORIGIN") || true, "App origin", mergedApp.VITE_APP_ORIGIN || "defaults to synexus.pro"));

section("Payments (Square)");
check(status(hasKey(mergedApp, "SQUARE_ACCESS_TOKEN"), "Square access token"));
check(status(hasKey(mergedApp, "SQUARE_LOCATION_ID"), "Square location ID"));
check(status(hasKey(mergedApp, "SQUARE_PLAN_VARIATION_ID_PRO"), "Square Pro plan variation ID"));
check(status(hasKey(mergedApp, "SQUARE_WEBHOOK_SIGNATURE_KEY"), "Square webhook signature key"));
check(status(hasKey(mergedApp, "SQUARE_WEBHOOK_NOTIFICATION_URL"), "Square webhook notification URL"));

section("Owner / analytics dashboard");
check(status(hasKey(mergedApp, "SYNEXUS_OWNER_EMAIL"), "Owner email"));
check(status(hasKey(mergedApp, "SYNEXUS_OWNER_PASSWORD"), "Owner password"));

section("Marketing — Telegram + YouTube");
check(status(hasKey(mEnv, "TELEGRAM_BOT_TOKEN"), "Telegram bot token"));
check(status(hasKey(mEnv, "TELEGRAM_CHAT_ID"), "Telegram chat ID"));
check(
  status(
    hasKey(mEnv, "YOUTUBE_REFRESH_TOKEN"),
    "YouTube refresh token",
    "npm run youtube:oauth in marketing-ai",
  ),
);

section("Marketing — needs attention");
const xOk = hasKey(mEnv, "X_ACCESS_TOKEN") && hasKey(mEnv, "X_ACCESS_SECRET");
check(status(xOk, "X/Twitter API", xOk ? "keys present — verify credits" : "missing or broken"));
const metaOk = hasKey(mEnv, "META_ACCESS_TOKEN") || hasKey(mEnv, "FACEBOOK_ACCESS_TOKEN");
check(status(metaOk, "Meta (FB/IG)", metaOk ? "configured" : "run: cd marketing-ai && npm run meta:auth"));

section("Hype creatives");
const creativesDir = join(marketing, "assets", "hype-creatives");
const statePath = join(marketing, "output", "hype-assets", "blast-state.json");
let posted = {};
if (existsSync(statePath)) {
  try {
    posted = JSON.parse(readFileSync(statePath, "utf8")).posted ?? {};
  } catch {
    /* ignore */
  }
}

const slots = [
  ["01-whale-alert", "whale-alert"],
  ["02-rise-above", "rise-above"],
  ["03-level-up", "level-up"],
  ["04-ai-mode", "ai-mode"],
  ["05-to-the-moon", "to-the-moon"],
  ["06-ai-sees", "ai-sees"],
  ["07-fast-moves", "fast-moves"],
  ["08-burn-risk", "burn-risk"],
  ["09-trust-ai", "trust-ai"],
  ["10-ai-chill", "ai-chill"],
];

let filesPresent = 0;
let filesMissing = 0;
let notPosted = [];

for (const [prefix, id] of slots) {
  const names = existsSync(creativesDir) ? readdirSync(creativesDir) : [];
  const hasFile = names.some((n) => n.toLowerCase().startsWith(prefix));
  if (hasFile) filesPresent += 1;
  else filesMissing += 1;

  const wasPosted = Boolean(posted[id]);
  const tag = wasPosted ? "posted" : hasFile ? "READY TO POST" : "no file";
  if (hasFile && !wasPosted) notPosted.push(id);
  console.log(`  ${wasPosted ? "✓" : hasFile ? "○" : "·"} ${prefix} → ${id} (${tag})`);
}

section("Database SQL (run once in Supabase)");
for (const file of ["schema.sql", "site_analytics.sql", "security_events.sql"]) {
  const p = join(root, "supabase", file);
  check(status(existsSync(p), file, existsSync(p) ? "exists locally" : "missing"));
}

section("Summary");
console.log(`  Checks passed: ${pass}`);
console.log(`  Gaps: ${fail}`);
if (notPosted.length) {
  console.log("\n  Next hype posts (one at a time):");
  for (const id of notPosted) {
    console.log(`    cd marketing-ai && npm run hype:post -- --only=${id}`);
  }
}
console.log("\n  Share scan links look like: https://synexus.pro/?scan=BONK");
console.log("  Analytics dashboard: /analytics (after command code on Pulse)");
console.log("  Full checklist: LAUNCH_CHECKLIST.md\n");

process.exit(fail > 0 ? 1 : 0);
