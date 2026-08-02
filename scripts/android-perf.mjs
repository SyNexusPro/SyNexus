#!/usr/bin/env node
/**
 * Android performance checklist + optional Lighthouse + adb device probe.
 *   npm run android:perf
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(import.meta.dirname, "..");
const sdk = join(homedir(), "AppData", "Local", "Android", "Sdk");
const adb = join(sdk, "platform-tools", "adb.exe");

console.log("\nSyNexus Android performance\n");

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: true });
}

if (existsSync(adb)) {
  const devices = run(adb, ["devices"]);
  console.log("ADB devices:");
  console.log(devices.stdout?.trim() || "(none)");
  console.log("\nTip: Android Studio → View → Tool Windows → App Inspection → Performance");
  console.log("     Or: Logcat filter `Choreographer` / `Skipped frames`\n");
} else {
  console.log("! ADB not found — install Android SDK Platform-Tools via Android Studio\n");
}

console.log("Freeze fixes in this repo:");
console.log("  • Slower polling on native Android (Pulse, Titan, movers)");
console.log("  • Polling pauses when app is backgrounded (@capacitor/app)");
console.log("  • WebView hardware acceleration in MainActivity");
console.log("  • Reduced animations via html.native-android CSS\n");

console.log("IMPORTANT: The Play Store shell loads https://www.synexus.pro");
console.log("  Deploy web changes to Vercel for the app to pick them up.");
console.log("  Or test bundled UI: CAPACITOR_USE_LOCAL=1 npm run cap:sync\n");

console.log("Running Lighthouse mobile audit…\n");
const audit = run("npm", ["run", "perf:audit"], { cwd: root, stdio: "inherit" });
process.exit(typeof audit.status === "number" ? audit.status : 0);
