import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLaunchVideoJob } from "./viralLaunchBlueprint.js";
import { renderSceneSvg } from "./videoArt.js";
import { renderSynBunnyStandaloneSvg, clearSynBunnyCache } from "./synBunny.js";
import {
  composeVideo,
  fileExists,
  logSummary,
  renderSvgToPng,
  synthesizeVoiceover,
  getMediaDurationSec,
} from "./videoPipeline.js";
import { DEFAULT_TTS_VOICE } from "./ttsVoice.js";
import { launchDayPath } from "./launchState.js";

async function renderScriptToDir(script, { force = false, quiet = false, outDir, long = false } = {}) {
  const dayDir = outDir || launchDayPath(script.day);
  const videoPath = join(dayDir, `${script.id}.mp4`);
  const metaPath = join(dayDir, `${script.id}-youtube.txt`);

  if (!force && (await fileExists(videoPath)) && (await fileExists(metaPath))) {
    if (!quiet) console.log(`  ↷ ${script.id} exists`);
    return { skipped: true, videoPath, metaPath, dayDir };
  }

  if (!quiet) console.log(`  ▶ ${script.id} · ${script.youtubeTitle?.slice(0, 50) || script.hook.slice(0, 48)}…`);

  const scenesDir = join(dayDir, "scenes", script.id);
  await mkdir(scenesDir, { recursive: true });

  const bunnyPng = join(dayDir, "syn-bunny.png");
  if (process.env.VIDEO_MASCOT?.trim() === "1" && !(await fileExists(bunnyPng))) {
    const bunnySvg = renderSynBunnyStandaloneSvg(512);
    await writeFile(join(dayDir, "syn-bunny.svg"), bunnySvg, "utf8");
    await renderSvgToPng(bunnySvg, bunnyPng);
  }
  clearSynBunnyCache();

  const audioPath = await synthesizeVoiceover(
    script.voiceover,
    join(dayDir, "audio", script.id),
    DEFAULT_TTS_VOICE,
    { style: "natural" },
  );
  await writeFile(join(dayDir, `${script.id}-voiceover.txt`), `${script.voiceover}\n`, "utf8");

  const audioSec = await getMediaDurationSec(audioPath);
  const job = buildLaunchVideoJob({ ...script, long: long || script.long }, audioSec);

  const scenePngPaths = [];
  for (let i = 0; i < job.scenes.length; i += 1) {
    const scene = job.scenes[i];
    const svg = renderSceneSvg(scene);
    const pngPath = join(scenesDir, `${String(i + 1).padStart(2, "0")}-${scene.phase || scene.id}.png`);
    await renderSvgToPng(svg, pngPath);
    scenePngPaths.push(pngPath);
    await writeFile(join(scenesDir, `${scene.phase || scene.id}-${i}.svg`), svg, "utf8");
  }

  const composed = await composeVideo({
    scenes: job.scenes,
    scenePngPaths,
    audioPath,
    videoPath,
    quiet: true,
  });

  const metadataBody = [
    `TITLE:\n${job.metadata.title}\n`,
    `DESCRIPTION:\n${job.metadata.description}\n`,
    `TAGS:\n${job.metadata.tags}\n`,
    `THUMBNAIL:\n${job.metadata.thumbnailText || script.thumbnailText || ""}\n`,
    `VOICEOVER SCRIPT:\n${script.voiceover}\n`,
  ].join("\n");
  const metadataPath = join(dayDir, `${script.id}-youtube.txt`);
  await writeFile(metadataPath, metadataBody, "utf8");

  if (script.tiktokCaption) await writeFile(join(dayDir, `${script.id}-tiktok.txt`), script.tiktokCaption, "utf8");
  if (script.telegramCaption) await writeFile(join(dayDir, `${script.id}-telegram.txt`), script.telegramCaption, "utf8");
  if (script.xCaption) await writeFile(join(dayDir, `${script.id}-x.txt`), script.xCaption, "utf8");

  if (!quiet) {
    logSummary({
      videoPath,
      metadataPath,
      audioSec: composed.audioSec,
      totalSec: composed.totalSec,
      quiet: false,
    });
    console.log(`  Beats: ${job.scenes.length} · ~${(composed.totalSec / job.scenes.length).toFixed(1)}s avg`);
  }

  return { skipped: false, videoPath, metadataPath, dayDir, script, ...composed };
}

export async function renderViralScript(script, opts = {}) {
  return renderScriptToDir(script, opts);
}

export async function renderLaunchVideo(script, { force = false, quiet = false } = {}) {
  return renderScriptToDir(script, { force, quiet, long: false });
}

export async function renderLaunchDay(scripts, { force = false, quiet = false } = {}) {
  const results = [];
  for (const script of scripts) {
    results.push(await renderLaunchVideo(script, { force, quiet }));
  }
  return results;
}
