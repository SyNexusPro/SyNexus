#!/usr/bin/env node
/**
 * Generate owner command code credentials and append to .env (if missing).
 * Run: node scripts/generate-owner-code.mjs
 */

import crypto from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

function randomSecret(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url");
}

async function main() {
  const email = `owner-${randomSecret(6).slice(0, 8).toLowerCase()}@synexus.local`;
  const password = randomSecret(24);
  const signingKey = randomSecret(32);

  let envText = "";
  if (existsSync(envPath)) {
    envText = await readFile(envPath, "utf8");
    if (/SYNEXUS_OWNER_EMAIL=/.test(envText)) {
      console.log("\nOwner credentials already exist in .env — not overwriting.\n");
      console.log("Edit SYNEXUS_OWNER_EMAIL and SYNEXUS_OWNER_PASSWORD in .env to change them.\n");
      return;
    }
  }

  const block = `
# Synexus owner command code (server-only — add same vars on Vercel for production)
SYNEXUS_OWNER_EMAIL=${email}
SYNEXUS_OWNER_PASSWORD=${password}
SYNEXUS_OWNER_SIGNING_KEY=${signingKey}
`;

  if (envText) {
    await appendFile(envPath, block, "utf8");
  } else {
    await writeFile(envPath, `# Generated ${new Date().toISOString()}${block}`, "utf8");
  }

  console.log("\nSynexus owner command code created\n");
  console.log("═".repeat(44));
  console.log(`Command ID:  ${email}`);
  console.log(`Command key: ${password}`);
  console.log("═".repeat(44));
  console.log("\nSaved to .env (gitignored). Also add these to Vercel env vars for production.");
  console.log("Use on Pulse → Operator link → Command code tab.\n");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
