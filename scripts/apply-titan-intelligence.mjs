#!/usr/bin/env node
/**
 * Apply supabase/titan_intelligence.sql using SUPABASE_DB_URL / POSTGRES_URL
 * or a raw postgresql:// line found in marketing-ai/.env / .env
 *
 * Direct db.*.supabase.co hosts are often IPv6-only; this falls back to the
 * Session pooler (IPv4) when needed.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function stripQuotes(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) {
      if (t.startsWith("postgresql://") || t.startsWith("postgres://")) {
        out.__RAW_PG__ = t;
      }
      continue;
    }
    out[t.slice(0, i).trim()] = stripQuotes(t.slice(i + 1));
  }
  return out;
}

/**
 * Parse postgres URLs safely. Never use `new URL()` first — `#` in passwords
 * is treated as a fragment and silently truncates the secret.
 */
function parsePgUrl(url) {
  const m = url.match(
    /^(postgres(?:ql)?:\/\/)([^:/\s]+):(.+)@([^/:?#\s]+)(?::(\d+))?(\/[^?#]*)?/i,
  );
  if (!m) return null;
  const [, , user, rawPass, host, port, path = "/postgres"] = m;
  let pass = rawPass;
  // strip accidental [brackets] from dashboard template paste
  if (pass.startsWith("[") && pass.endsWith("]")) {
    pass = pass.slice(1, -1);
  }
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

function normalizePgUrl(url) {
  const p = parsePgUrl(url);
  if (!p) return url;
  return buildPgUrl(p);
}

/** Convert direct db host → session pooler (IPv4-friendly). */
function toSessionPoolerUrls(url, region = "us-east-1") {
  const p = parsePgUrl(url);
  if (!p) return [];
  const m = p.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (!m) return [];
  const ref = m[1];
  // Newer projects often land on aws-1-*, not aws-0-*
  return [1, 0, 2].map((n) => ({
    label: `session pooler aws-${n}-${region}`,
    url: buildPgUrl({
      user: p.user.includes(".") ? p.user : `postgres.${ref}`,
      pass: p.pass,
      host: `aws-${n}-${region}.pooler.supabase.com`,
      port: "5432",
      path: p.path,
    }),
  }));
}

async function tryApply(dbUrl, label) {
  const sql = postgres(dbUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    ssl: "require",
    prepare: false,
  });
  console.log(`Connecting via ${label} …`);
  try {
    await sql.unsafe(body);
    console.log("OK — Titan intelligence tables/columns applied.");

    const cols = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name in ('subscription_status','notifications_enabled','instant_alerts','daily_digest')
      order by column_name
    `;
    console.log(
      "profiles columns:",
      cols.map((c) => c.column_name).join(", ") || "(none — unexpected)",
    );

    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('titan_events','titan_notifications','push_subscriptions')
      order by table_name
    `;
    console.log("tables:", tables.map((t) => t.table_name).join(", "));
    return true;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const merged = {
  ...readEnvFile(join(root, ".env")),
  ...readEnvFile(join(root, "marketing-ai", ".env")),
  ...process.env,
};

let dbUrl =
  merged.SUPABASE_DB_URL ||
  merged.POSTGRES_URL ||
  merged.POSTGRES_URL_NON_POOLING ||
  merged.DATABASE_URL ||
  merged.__RAW_PG__ ||
  "";

if (!dbUrl || dbUrl === "[SENSITIVE]" || !/^postgres/i.test(dbUrl)) {
  console.error("No usable Postgres URL found.");
  process.exit(1);
}

const parsed = parsePgUrl(dbUrl);
if (parsed) {
  console.log(
    `Using host ${parsed.host} (password length ${parsed.pass.length}, special chars encoded)`,
  );
}
dbUrl = normalizePgUrl(dbUrl);
const sqlFile = join(root, "supabase", "titan_intelligence.sql");
const body = readFileSync(sqlFile, "utf8");

const region = process.env.SUPABASE_REGION || "us-east-1";
const candidates = [{ url: dbUrl, label: "provided URL" }, ...toSessionPoolerUrls(dbUrl, region)];

let lastErr;
for (const c of candidates) {
  try {
    await tryApply(c.url, c.label);
    process.exit(0);
  } catch (err) {
    lastErr = err;
    console.error(`FAILED (${c.label}):`, err.message || err);
  }
}

console.error("All connection attempts failed.", lastErr?.message || "");
process.exit(1);
