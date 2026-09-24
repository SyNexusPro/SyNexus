/**
 * Bump package.json + Android versionCode/versionName together.
 * Play Console rejects a reused versionCode.
 *
 *   npm run version:android
 *   APP_VERSION=1.1.0 npm run version:android
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pkgPath = join(root, "package.json");
const lockPath = join(root, "package-lock.json");
const gradlePath = join(root, "android", "app", "build.gradle");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const currentName = String(pkg.version ?? "0.0.0");
const override = process.env.APP_VERSION?.trim();
let nextName = override;

if (!nextName) {
  const parts = currentName.split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Cannot bump version "${currentName}". Use APP_VERSION=x.y.z`);
  }
  parts[2] += 1;
  nextName = parts.join(".");
}

pkg.version = nextName;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.version = nextName;
  if (lock.packages?.[""]) lock.packages[""].version = nextName;
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

const gradle = readFileSync(gradlePath, "utf8");
const codeMatch = gradle.match(/versionCode\s+(\d+)/);
if (!codeMatch) {
  throw new Error("versionCode not found in android/app/build.gradle");
}
const nextCode = Number(codeMatch[1]) + 1;
if (!Number.isInteger(nextCode) || nextCode <= 0) {
  throw new Error("Invalid versionCode in android/app/build.gradle");
}

let nextGradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
if (!/versionName\s+"[^"]+"/.test(nextGradle)) {
  throw new Error("versionName not found in android/app/build.gradle");
}
nextGradle = nextGradle.replace(/versionName\s+"[^"]+"/, `versionName "${nextName}"`);
writeFileSync(gradlePath, nextGradle);

console.log(`Version ${currentName} → ${nextName} (versionCode ${nextCode})`);
