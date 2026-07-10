#!/usr/bin/env node
/**
 * Verify Supabase connectivity and required tables.
 *   npm run supabase:health
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

function status(ok, label, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

const env = readEnvFile(join(root, ".env"));
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY || "";

let pass = 0;
let fail = 0;

function check(ok) {
  if (ok) pass += 1;
  else fail += 1;
  return ok;
}

console.log("\nSupabase health");
console.log("───────────────");

check(status(Boolean(url), "Project URL configured"));
check(status(Boolean(anonKey), "Anon / publishable key configured"));
check(
  status(
    Boolean(serviceRole),
    "Service role key (server)",
    serviceRole ? "set" : "missing — needed for Creem webhooks + /analytics",
  ),
);

if (!url || !anonKey) {
  console.log("\n  Fix: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env\n");
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Tables the app reads/writes — grouped by priority. */
const CORE_TABLES = ["profiles", "watchlists", "watchlist_tokens", "guardian_alerts"];
const EXTENDED_TABLES = ["token_reports", "tracked_tokens"];
const OPTIONAL_TABLES = ["site_analytics_events", "security_events", "treasury_revenue"];

async function probeTable(table) {
  const { error } = await client.from(table).select("*").limit(1);
  if (!error) return "ok";
  if (error.code === "PGRST205") return "missing";
  return error.message ?? "error";
}

console.log("\nCore tables (auth, watchlists, alerts)");
for (const table of CORE_TABLES) {
  const result = await probeTable(table);
  check(status(result === "ok", table, result === "ok" ? "reachable" : result));
}

console.log("\nExtended tables (reports, tracked tokens)");
for (const table of EXTENDED_TABLES) {
  const result = await probeTable(table);
  check(status(result === "ok", table, result === "ok" ? "reachable" : result));
}

console.log("\nOptional tables (analytics, security audit, treasury)");
for (const table of OPTIONAL_TABLES) {
  const result = await probeTable(table);
  check(status(result === "ok", table, result === "ok" ? "reachable" : result === "missing" ? "not created yet" : result));
}

let authOk = false;
try {
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  authOk = response.ok;
  check(status(authOk, "Auth API", authOk ? "online" : `HTTP ${response.status}`));
} catch (error) {
  check(status(false, "Auth API", error instanceof Error ? error.message : "unreachable"));
}

console.log("\nSummary");
console.log("───────");
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);

if (fail > 0) {
  console.log("\n  Recommended fixes:");
  console.log("  1. Supabase Dashboard → SQL Editor → run supabase/schema.sql");
  console.log("  2. Optional: supabase/site_analytics.sql and supabase/security_events.sql");
  console.log("  3. Dashboard → Settings → API → copy service_role key → SUPABASE_SERVICE_ROLE_KEY in .env + Vercel");
  console.log("  4. Authentication → URL configuration → add http://localhost:5173 and your production domain\n");
}

process.exit(fail > 0 ? 1 : 0);
