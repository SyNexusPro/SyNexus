import { createWriteStream } from "node:fs";
import { mkdir, writeFile, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { Resvg } from "@resvg/resvg-js";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { renderSceneSvg } from "./videoArt.js";
import { formatDuration } from "./videoUtils.js";

const FPS = 30;
const XFADE_SEC = 0.55;
const MIN_TOTAL_SEC = 28;

export async function renderSvgToPng(svg, outPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1080 },
    font: { loadSystemFonts: true },
  });
  await writeFile(outPath, resvg.render().asPng());
}

export async function synthesizeVoiceover(text, outDir, voice) {
  await mkdir(outDir, { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(outDir, text);
  return audioFilePath;
}

export function runFfmpeg(args, { quiet = false } = {}) {
  if (!ffmpegPath) {
    return Promise.reject(new Error("ffmpeg-static binary not found."));
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (!quiet) process.stderr.write(chunk);
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`FFmpeg failed (${code})\n${stderr.slice(-2000)}`));
    });
  });
}

export async function getMediaDurationSec(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ["-i", filePath], { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", () => {
      const m = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (!m) {
        reject(new Error(`Could not read audio duration for ${filePath}`));
        return;
      }
      resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
  });
}

function sceneDurationSec(totalSec, ratio) {
  return Math.max(2.8, totalSec * ratio);
}

function buildZoomFilter(inputLabel, outLabel, frames) {
  return `[${inputLabel}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.00045,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${FPS},format=yuv420p[${outLabel}]`;
}

export async function composeVideo({ scenes, scenePngPaths, audioPath, videoPath, quiet }) {
  const audioSec = await getMediaDurationSec(audioPath);
  const totalSec = Math.max(MIN_TOTAL_SEC, audioSec + 1.2);

  const ratios = scenes.map((s) => s.durationRatio);
  const ratioSum = ratios.reduce((a, b) => a + b, 0);
  const durations = scenes.map((s, i) => sceneDurationSec(totalSec, ratios[i] / ratioSum));

  // Scale durations so sum minus xfades ~= totalSec
  const xfadeLoss = XFADE_SEC * (scenes.length - 1);
  const rawSum = durations.reduce((a, b) => a + b, 0);
  const scale = (totalSec + xfadeLoss) / rawSum;
  const scaled = durations.map((d) => d * scale);

  const inputs = [];
  const filterParts = [];
  const zoomLabels = [];

  for (let i = 0; i < scenePngPaths.length; i += 1) {
    inputs.push("-loop", "1", "-t", String(scaled[i].toFixed(3)), "-i", scenePngPaths[i]);
    const zLabel = `z${i}`;
    zoomLabels.push(zLabel);
    const frames = Math.ceil(scaled[i] * FPS);
    filterParts.push(buildZoomFilter(i, zLabel, frames));
  }

  let last = zoomLabels[0];
  if (zoomLabels.length === 1) {
    filterParts.push(`[${last}]null[vout]`);
  } else {
    let offset = scaled[0] - XFADE_SEC;
    for (let i = 1; i < zoomLabels.length; i += 1) {
      const out = i === zoomLabels.length - 1 ? "vout" : `x${i}`;
      filterParts.push(
        `[${last}][${zoomLabels[i]}]xfade=transition=fadeblack:duration=${XFADE_SEC}:offset=${offset.toFixed(3)}[${out}]`,
      );
      last = out;
      offset += scaled[i] - XFADE_SEC;
    }
  }

  const args = [
    "-y",
    ...inputs,
    "-i",
    audioPath,
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[vout]",
    "-map",
    `${scenePngPaths.length}:a`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "17",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    "-shortest",
    videoPath,
  ];

  await runFfmpeg(args, { quiet });
  return { audioSec, totalSec, sceneDurations: scaled };
}

export async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function logSummary({ videoPath, metadataPath, audioSec, totalSec, quiet }) {
  if (quiet) return;
  console.log("\n✓ Synexus daily video ready");
  console.log(`  Duration: ~${formatDuration(totalSec)} (voice ${formatDuration(audioSec)})`);
  console.log(`  Video:    ${videoPath}`);
  console.log(`  Upload:   ${metadataPath}`);
}

export async function writeYouTubeMetadata(dir, metadata, voiceover) {
  const body = [
    `TITLE:\n${metadata.title}\n`,
    `DESCRIPTION:\n${metadata.description}\n`,
    `TAGS:\n${metadata.tags}\n`,
    `VOICEOVER SCRIPT:\n${voiceover}\n`,
  ].join("\n");
  const path = join(dir, "youtube-upload.txt");
  await writeFile(path, body, "utf8");
  return path;
}

export async function streamToFile(stream, filePath) {
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(filePath);
    stream.pipe(ws);
    ws.on("finish", resolve);
    ws.on("error", reject);
    stream.on("error", reject);
  });
}
