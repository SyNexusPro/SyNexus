#!/usr/bin/env node
/**
 * Android-only Capacitor health check (Windows / Play Store — skips Xcode).
 *   npm run android:doctor
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(import.meta.dirname, "..");
const androidDir = join(root, "android");
const configFile = join(root, "capacitor.config.ts");

function ok(label, detail = "") {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

let errors = 0;

console.log("\nSyNexus Android (Google Play)\n");

if (existsSync(androidDir)) ok("android/ project exists");
else {
  fail("android/ project missing", "run: npx cap add android");
  errors++;
}

if (existsSync(configFile)) ok("capacitor.config.ts");
else {
  fail("capacitor.config.ts missing");
  errors++;
}

const sync = spawnSync("npx cap sync android", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (sync.status === 0) ok("cap sync android");
else {
  fail("cap sync android failed");
  errors++;
}

console.log("\nCommands (do not use cap add — platform already exists):");
console.log("  npm run cap:sync       # web build + sync Android");
console.log("  npm run android:bundle # signed AAB for Play Console");
console.log("  npx cap open android   # Android Studio\n");

if (errors > 0) process.exit(1);

console.log("Android looking great — Xcode is not required for Google Play.\n");
