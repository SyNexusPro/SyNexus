import sharp from "sharp";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "public", "synexus-logo.png");
const output = path.join(root, "public", "synexus-symbol.png");

const canvas = 512;
const bg = { r: 10, g: 10, b: 10, alpha: 1 };

// Full S emblem only — stop before the SYNEXUS wordmark (source is 682×1024).
const emblem = await sharp(input)
  .extract({ left: 8, top: 0, width: 666, height: 592 })
  .resize(468, 468, { fit: "inside" })
  .toBuffer();

const { width = 468, height = 468 } = await sharp(emblem).metadata();
const left = Math.max(0, Math.round((canvas - width) / 2));
const top = 6;

await sharp({
  create: { width: canvas, height: canvas, channels: 4, background: bg },
})
  .composite([{ input: emblem, left, top }])
  .png()
  .toFile(output);

console.log("Wrote", output, `${width}x${height} at ${left},${top}`);
