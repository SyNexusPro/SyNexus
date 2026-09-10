/**
 * Generates SyNexus launcher icons + splash from public/synexus-symbol.png.
 * Addresses Android lint Usability: IconLauncherShape, MonochromeLauncherIcon, IconLocation.
 * Run: npm run android:icons
 */
import sharp from "sharp";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "synexus-symbol.png");
const resRoot = path.join(root, "android", "app", "src", "main", "res");

const BRAND_BG = { r: 7, g: 16, b: 7, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const densities = {
  mdpi: { launcher: 48, foreground: 108, monochrome: 48 },
  hdpi: { launcher: 72, foreground: 162, monochrome: 72 },
  xhdpi: { launcher: 96, foreground: 216, monochrome: 96 },
  xxhdpi: { launcher: 144, foreground: 324, monochrome: 144 },
  xxxhdpi: { launcher: 192, foreground: 432, monochrome: 192 },
};

async function paddedIcon(size, dest, { innerRatio = 0.62, background = BRAND_BG, tint = null } = {}) {
  await mkdir(path.dirname(dest), { recursive: true });
  const inner = Math.max(1, Math.round(size * innerRatio));
  let img = sharp(source).resize(inner, inner, { fit: "contain", background: TRANSPARENT });
  if (tint) {
    img = img.flatten({ background: TRANSPARENT }).tint(tint);
  }
  const buf = await img
    .extend({
      top: Math.floor((size - inner) / 2),
      bottom: Math.ceil((size - inner) / 2),
      left: Math.floor((size - inner) / 2),
      right: Math.ceil((size - inner) / 2),
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  if (background.alpha === 1 && background.r + background.g + background.b > 0) {
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background,
      },
    })
      .composite([{ input: buf, gravity: "centre" }])
      .png()
      .toFile(dest);
    return;
  }

  await sharp(buf).png().toFile(dest);
}

async function writeAdaptiveXml(name) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
  await mkdir(path.join(resRoot, "mipmap-anydpi-v26"), { recursive: true });
  await writeFile(path.join(resRoot, "mipmap-anydpi-v26", `${name}.xml`), xml, "utf8");
}

async function cleanupLegacyResources() {
  const removePaths = [
    path.join(resRoot, "drawable-v24"),
    path.join(resRoot, "drawable", "ic_launcher_background.xml"),
    path.join(resRoot, "drawable", "splash.png"),
    path.join(resRoot, "layout", "activity_main.xml"),
  ];

  for (const dir of ["drawable-port-mdpi", "drawable-port-hdpi", "drawable-port-xhdpi", "drawable-port-xxhdpi", "drawable-port-xxxhdpi", "drawable-land-mdpi", "drawable-land-hdpi", "drawable-land-xhdpi", "drawable-land-xxhdpi", "drawable-land-xxxhdpi"]) {
    removePaths.push(path.join(resRoot, dir));
  }

  for (const [density] of Object.entries(densities)) {
    removePaths.push(path.join(resRoot, `mipmap-${density}`, "ic_launcher_round.png"));
  }

  for (const p of removePaths) {
    await rm(p, { recursive: true, force: true });
  }
}

async function writeSplash() {
  const splashDir = path.join(resRoot, "drawable-nodpi");
  await mkdir(splashDir, { recursive: true });
  await sharp(source)
    .resize(512, 512, { fit: "contain", background: BRAND_BG })
    .png()
    .toFile(path.join(splashDir, "splash.png"));
}

async function writeKeepResources() {
  const keepXml = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@string/package_name,@string/custom_url_scheme,@xml/config" />
`;
  await mkdir(path.join(resRoot, "raw"), { recursive: true });
  await writeFile(path.join(resRoot, "raw", "keep.xml"), keepXml, "utf8");
}

for (const [density, sizes] of Object.entries(densities)) {
  const dir = path.join(resRoot, `mipmap-${density}`);
  await paddedIcon(sizes.launcher, path.join(dir, "ic_launcher.png"), { innerRatio: 0.38, background: TRANSPARENT });
  await paddedIcon(sizes.foreground, path.join(dir, "ic_launcher_foreground.png"), {
    innerRatio: 0.42,
    background: TRANSPARENT,
  });
  await paddedIcon(sizes.monochrome, path.join(dir, "ic_launcher_monochrome.png"), {
    innerRatio: 0.58,
    background: TRANSPARENT,
    tint: { r: 255, g: 255, b: 255 },
  });
}

await writeAdaptiveXml("ic_launcher");
await writeAdaptiveXml("ic_launcher_round");
await writeSplash();
await writeKeepResources();
await cleanupLegacyResources();

const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#071007</color>
</resources>
`;
await writeFile(path.join(resRoot, "values", "ic_launcher_background.xml"), backgroundXml, "utf8");

console.log("SyNexus Android launcher icons, splash, and lint-friendly resources updated.");
