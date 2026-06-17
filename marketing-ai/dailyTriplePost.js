#!/usr/bin/env node
/** Alias — npm run posts:* → dailyBlastPost.js */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(__dirname, "dailyBlastPost.js");
const child = spawn(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
