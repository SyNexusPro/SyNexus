#!/usr/bin/env node
/**
 * Apply legacy Supabase SQL plus tracked supabase/migrations/*.sql files.
 * Requires SUPABASE_DB_URL in .env (Database → Connection string → URI, Session pooler).
 *   npm run supabase:migrate
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIGRATION_FILES = [
  "supabase/schema.sql",
  "supabase/site_analytics.sql",
  "supabase/security_events.sql",
  "supabase/whale_alerts.sql",
  "supabase/titan_intelligence.sql",
];
const VERSIONED_MIGRATIONS_DIR = join(root, "supabase", "migrations");

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
const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  env.SUPABASE_DB_URL ||
  env.POSTGRES_URL ||
  env.DATABASE_URL ||
  "";
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

  await sql.unsafe(`
    create schema if not exists synexus_private;
    create table if not exists synexus_private.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const versionedFiles = existsSync(VERSIONED_MIGRATIONS_DIR)
    ? readdirSync(VERSIONED_MIGRATIONS_DIR)
        .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
        .sort()
    : [];

  for (const name of versionedFiles) {
    const relativePath = `supabase/migrations/${name}`;
    const existing = await sql.unsafe(
      "select 1 from synexus_private.schema_migrations where name = $1 limit 1",
      [name],
    );
    if (existing.length) {
      console.log(`  · skip ${relativePath} (already applied)`);
      continue;
    }

    const body = readFileSync(join(VERSIONED_MIGRATIONS_DIR, name), "utf8");
    process.stdout.write(`  → ${relativePath} ... `);
    await sql.begin(async (transaction) => {
      await transaction.unsafe(body);
      await transaction.unsafe(
        "insert into synexus_private.schema_migrations (name) values ($1)",
        [name],
      );
    });
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
