/**
 * Generates SyNexus launcher icons from public/synexus-symbol.png into android/app/src/main/res/mipmap-*.
 * Run: node scripts/generate-android-icons.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "synexus-symbol.png");
const resRoot = path.join(root, "android", "app", "src", "main", "res");

const densities = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 },
};

async function writeSquarePng(size, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp(source)
    .resize(size, size, { fit: "contain", background: { r: 7, g: 16, b: 7, alpha: 1 } })
    .png()
    .toFile(dest);
}

for (const [density, sizes] of Object.entries(densities)) {
  const dir = path.join(resRoot, `mipmap-${density}`);
  await writeSquarePng(sizes.launcher, path.join(dir, "ic_launcher.png"));
  await writeSquarePng(sizes.launcher, path.join(dir, "ic_launcher_round.png"));
  await writeSquarePng(sizes.foreground, path.join(dir, "ic_launcher_foreground.png"));
}

const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#071007</color>
</resources>
`;
await writeFile(path.join(resRoot, "values", "ic_launcher_background.xml"), backgroundXml, "utf8");

console.log("SyNexus Android launcher icons updated.");
