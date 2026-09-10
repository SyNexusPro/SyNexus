#!/usr/bin/env node
/**
 * Mobile performance audit (Lighthouse) for SyNexus production URL.
 *   npm run perf:audit
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const url = process.env.PERF_AUDIT_URL?.trim() || "https://www.synexus.pro/pulse";
const outDir = join(root, "reports", "perf");

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonOut = join(outDir, `lighthouse-${stamp}.json`);
const htmlOut = join(outDir, `lighthouse-${stamp}.html`);

console.log(`\nLighthouse mobile audit → ${url}\n`);

const result = spawnSync(
  "npx",
  [
    "lighthouse",
    url,
    "--preset=perf",
    "--form-factor=mobile",
    "--screenEmulation.mobile",
    "--throttling.cpuSlowdownMultiplier=4",
    "--output=json",
    "--output=html",
    `--output-path=${jsonOut.replace(".json", "")}`,
    "--quiet",
    "--chrome-flags=--headless=new --no-sandbox",
  ],
  { cwd: root, stdio: "inherit", shell: true },
);

if (result.status !== 0) {
  console.error("\nLighthouse failed. Install Chrome/Edge if missing.\n");
  process.exit(result.status ?? 1);
}

writeFileSync(
  join(outDir, "latest.txt"),
  `json: ${jsonOut}\nhtml: ${htmlOut}\nurl: ${url}\n`,
  "utf8",
);

console.log(`\nReports saved:\n  ${htmlOut}\n`);
