#!/usr/bin/env node
/**
 * Apply Supabase SQL migrations from supabase/*.sql
 * Requires SUPABASE_DB_URL in .env (Database → Connection string → URI, Session pooler).
 *   npm run supabase:migrate
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIGRATION_FILES = [
  "supabase/schema.sql",
  "supabase/site_analytics.sql",
  "supabase/security_events.sql",
];

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

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

const env = readEnvFile(join(root, ".env"));
const dbUrl = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL || env.DATABASE_URL || "";
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
const projectRef = projectRefFromUrl(supabaseUrl);

if (!dbUrl) {
  console.error("\nSupabase migrate — missing database URL\n");
  console.error("Add to .env (from Supabase Dashboard → Connect → URI, Session mode):");
  console.error("  SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres");
  if (projectRef) {
    console.error(`\nOpen: https://supabase.com/dashboard/project/${projectRef}/settings/database`);
  }
  console.error("\nOr paste supabase/schema.sql (+ site_analytics.sql, security_events.sql) in SQL Editor.\n");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 15 });

console.log("\nSupabase migrate");
console.log("────────────────");

let applied = 0;
try {
  for (const relativePath of MIGRATION_FILES) {
    const filePath = join(root, relativePath);
    if (!existsSync(filePath)) {
      console.log(`  · skip ${relativePath} (not found)`);
      continue;
    }
    const body = readFileSync(filePath, "utf8");
    process.stdout.write(`  → ${relativePath} ... `);
    await sql.unsafe(body);
    console.log("ok");
    applied += 1;
  }
  console.log(`\nDone — ${applied} file(s) applied.\n`);
} catch (error) {
  console.error("\nMigration failed:");
  console.error(error instanceof Error ? error.message : error);
  console.error("\nIf auth failed, reset the DB password in Supabase → Settings → Database.\n");
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
