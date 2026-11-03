#!/usr/bin/env node
/**
 * Apply Hera memory, Alexus reports, and the unused card-webhook drop.
 * Reads POSTGRES_URL from ENV_FILE or the process environment.
 * Never prints the database URL.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "supabase/hera_memory.sql",
  "supabase/alexus_reports.sql",
  "supabase/migrations/202611030001_drop_card_webhook_events.sql",
];

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    out[trimmed.slice(0, index).trim()] = stripQuotes(trimmed.slice(index + 1));
  }
  return out;
}

function parsePgUrl(url) {
  const match = url.match(
    /^(postgres(?:ql)?:\/\/)([^:/\s]+):(.+)@([^/:?#\s]+)(?::(\d+))?(\/[^?#]*)?/i,
  );
  if (!match) return null;
  const [, , user, rawPass, host, port, path = "/postgres"] = match;
  let pass = rawPass;
  if (pass.startsWith("[") && pass.endsWith("]")) pass = pass.slice(1, -1);
  return {
    user: decodeURIComponent(user),
    pass: decodeURIComponent(pass),
    host,
    port: port || "5432",
    path: path || "/postgres",
  };
}

function buildPgUrl({ user, pass, host, port, path }) {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}${path}`;
}

function toSessionPoolerUrls(url, region = "us-east-1") {
  const parsed = parsePgUrl(url);
  if (!parsed) return [];
  const match = parsed.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (!match) return [];
  const ref = match[1];
  return [1, 0, 2].map((n) =>
    buildPgUrl({
      user: parsed.user.includes(".") ? parsed.user : `postgres.${ref}`,
      pass: parsed.pass,
      host: `aws-${n}-${region}.pooler.supabase.com`,
      port: "5432",
      path: parsed.path,
    }),
  );
}

function safeError(error) {
  return String(error?.message || error).replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://redacted");
}

const envFile = process.env.ENV_FILE || "";
const merged = {
  ...(envFile ? readEnvFile(envFile) : {}),
  ...process.env,
};
const dbUrl = merged.POSTGRES_URL || merged.SUPABASE_DB_URL || merged.DATABASE_URL || "";
if (!dbUrl || !/^postgres/i.test(dbUrl)) {
  console.error("No usable Postgres URL found.");
  process.exit(1);
}

const parsed = parsePgUrl(dbUrl);
const candidates = parsed ? [buildPgUrl(parsed), ...toSessionPoolerUrls(dbUrl)] : [dbUrl];
const body = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");

let lastError;
for (const candidate of candidates) {
  const sql = postgres(candidate, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    ssl: "require",
    prepare: false,
  });
  try {
    await sql.unsafe(body);
    const tables = await sql`
      select to_regclass('public.hera_memory') as hera_memory,
             to_regclass('public.alexus_reports') as alexus_reports,
             to_regclass('public.square_webhook_events') as card_events
    `;
    const row = tables[0] ?? {};
    console.log(
      `hera_memory=${row.hera_memory ? "present" : "missing"} alexus_reports=${row.alexus_reports ? "present" : "missing"} card_webhook_table=${row.card_events ? "still-present" : "gone"}`,
    );
    await sql.end({ timeout: 5 });
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`attempt failed: ${safeError(error)}`);
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

console.error(`All connection attempts failed. ${safeError(lastError)}`);
process.exit(1);
