/**
 * Runs Gradle release build from `/android`. Cross-platform wrapper for `npm run android:bundle` / `:apk`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function resolveJavaHome() {
  if (process.env.JAVA_HOME?.trim()) return process.env.JAVA_HOME.trim();

  if (process.platform === "win32") {
    const studioRoots = [
      "C:\\Program Files\\Android\\Android Studio\\jbr",
      join(process.env.LOCALAPPDATA ?? "", "Programs", "Android Studio", "jbr"),
    ];
    for (const root of studioRoots) {
      if (existsSync(join(root, "bin", "java.exe"))) return root;
    }

    const adoptiumRoot = "C:\\Program Files\\Eclipse Adoptium";
    if (existsSync(adoptiumRoot)) {
      const jdks = readdirSync(adoptiumRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("jdk-21"))
        .map((entry) => join(adoptiumRoot, entry.name))
        .sort()
        .reverse();
      if (jdks[0]) return jdks[0];
    }
  }

  return null;
}

function resolveAndroidHome() {
  if (process.env.ANDROID_HOME?.trim()) return process.env.ANDROID_HOME.trim();
  if (process.platform === "win32") {
    const sdk = join(homedir(), "AppData", "Local", "Android", "Sdk");
    if (existsSync(sdk)) return sdk;
  }
  return null;
}

const cwd = join(process.cwd(), "android");
const isWin = process.platform === "win32";
const gradleBin = isWin ? "gradlew.bat" : "./gradlew";
const mode = process.argv[2] === "apk" ? "assembleRelease" : "bundleRelease";

const env = { ...process.env };
const javaHome = resolveJavaHome();
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.Path = `${join(javaHome, "bin")}${isWin ? ";" : ":"}${env.Path ?? ""}`;
}
const androidHome = resolveAndroidHome();
if (androidHome) {
  env.ANDROID_HOME = androidHome;
}

const result = spawnSync(gradleBin, [mode], {
  cwd,
  stdio: "inherit",
  shell: isWin,
  env,
});

process.exit(typeof result.status === "number" ? result.status : 1);
