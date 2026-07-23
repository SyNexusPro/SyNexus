#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vercelEnvPath = join(root, ".env.vercel");

if (!existsSync(vercelEnvPath)) {
  console.error("Missing .env.vercel — run: npx vercel env pull .env.vercel --environment=production --yes");
  process.exit(1);
}

const lines = readFileSync(vercelEnvPath, "utf8").split(/\r?\n/);
const postgresLine = lines.find((line) => line.startsWith("POSTGRES_URL="));
if (!postgresLine) {
  console.error("POSTGRES_URL not found in .env.vercel");
  process.exit(1);
}

const dbUrl = postgresLine.slice("POSTGRES_URL=".length).replace(/^"|"$/g, "");
const result = spawnSync("node", ["scripts/supabase-migrate.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, SUPABASE_DB_URL: dbUrl },
});

process.exit(result.status ?? 1);
