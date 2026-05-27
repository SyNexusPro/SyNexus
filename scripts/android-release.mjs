/**
 * Runs Gradle release build from `/android`. Cross-platform wrapper for `npm run android:bundle` / `:apk`.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cwd = join(process.cwd(), "android");
const isWin = process.platform === "win32";
const gradleBin = isWin ? "gradlew.bat" : "./gradlew";
const mode = process.argv[2] === "apk" ? "assembleRelease" : "bundleRelease";

const result = spawnSync(gradleBin, [mode], {
  cwd,
  stdio: "inherit",
  shell: isWin,
});

process.exit(typeof result.status === "number" ? result.status : 1);
