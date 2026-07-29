#!/usr/bin/env node
/**
 * Optional go-live extras: Supabase SQL migrations + Meta marketing auth prep.
 *   node scripts/setup-optional-services.mjs
 *   node scripts/setup-optional-services.mjs --migrate
 *   node scripts/setup-optional-services.mjs --meta
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "zyroyqcyjmcgdcywnjxn";
const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
const dbSettingsUrl = `https://supabase.com/dashboard/project/${projectRef}/settings/database`;

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

function openUrl(url) {
  const platform = process.platform;
  if (platform === "win32") {
    spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  } else if (platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
  } else {
    spawnSync("xdg-open", [url], { stdio: "ignore" });
  }
}

const flags = new Set(process.argv.slice(2));
const runMigrate = flags.has("--migrate") || flags.size === 0;
const runMeta = flags.has("--meta") || flags.size === 0;

const env = readEnvFile(join(root, ".env"));
const mEnv = readEnvFile(join(root, "marketing-ai", ".env"));
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  env.SUPABASE_DB_URL ||
  env.POSTGRES_URL ||
  "";

console.log("\nSyNexus — optional services setup");
console.log("══════════════════════════════════\n");

if (runMigrate) {
  console.log("1) Supabase migrations (token_reports, analytics, treasury, …)");
  if (dbUrl && dbUrl.startsWith("postgres")) {
    console.log("   → Running npm run supabase:migrate …\n");
    const result = spawnSync("npm", ["run", "supabase:migrate"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SUPABASE_DB_URL: dbUrl },
    });
    if (result.status === 0) {
      console.log("\n   ✓ Migrations applied.\n");
    } else {
      console.log("\n   ✗ Migration failed — use SQL Editor fallback below.\n");
    }
  } else {
    const applyAll = join(root, "supabase", "apply-all.sql");
    console.log("   SUPABASE_DB_URL not set in .env (Vercel POSTGRES_URL is empty too).");
    console.log("   Fastest path — paste one file in Supabase SQL Editor:");
    console.log(`   • File: supabase/apply-all.sql`);
    console.log(`   • Editor: ${sqlEditorUrl}`);
    console.log("\n   Or add to .env then re-run with --migrate:");
    console.log("   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres");
    console.log(`   Password: ${dbSettingsUrl} → Database password → Reset if needed\n`);
    openUrl(sqlEditorUrl);
  }
}

if (runMeta) {
  console.log("2) Meta (Facebook Page + Instagram Reels auto-post)");
  const hasMetaApp = Boolean(mEnv.META_APP_ID?.trim() && mEnv.META_APP_SECRET?.trim());
  const hasMetaToken = Boolean(mEnv.META_PAGE_ACCESS_TOKEN?.trim() && mEnv.META_PAGE_ID?.trim());

  if (hasMetaToken) {
    console.log("   ✓ META_PAGE_ID + META_PAGE_ACCESS_TOKEN already in marketing-ai/.env");
    console.log("   Verify: cd marketing-ai && npm run platform:check\n");
  } else if (hasMetaApp) {
    console.log("   App credentials found. Complete OAuth:");
    console.log("   cd marketing-ai && npm run meta:auth\n");
  } else {
    console.log("   Add to marketing-ai/.env:");
    console.log("     META_APP_ID=");
    console.log("     META_APP_SECRET=");
    console.log("     META_REDIRECT_URI=https://localhost/");
    console.log("\n   Create app: https://developers.facebook.com/apps/");
    console.log("   • App type: Business");
    console.log("   • Products: Facebook Login + Instagram Graph API");
    console.log("   • OAuth redirect: https://localhost/ (must match META_REDIRECT_URI)");
    console.log("   • Link Facebook Page + Instagram Business/Creator in Meta Business Suite");
    console.log("\n   Then: cd marketing-ai && npm run meta:auth\n");
    openUrl("https://developers.facebook.com/apps/");
  }
}

console.log("After Supabase SQL: npm run supabase:health");
console.log("After Meta auth:      cd marketing-ai && npm run platform:check\n");
