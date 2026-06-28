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
} from "./videoPipeline.js";
import { DEFAULT_TTS_VOICE } from "./ttsVoice.js";
import { launchDayPath } from "./launchState.js";

export async function renderLaunchVideo(script, { force = false, quiet = false } = {}) {
  const job = buildLaunchVideoJob(script);
  const dayDir = launchDayPath(script.day);
  const videoPath = join(dayDir, `${script.id}.mp4`);
  const metaPath = join(dayDir, `${script.id}-youtube.txt`);

  if (!force && (await fileExists(videoPath)) && (await fileExists(metaPath))) {
    if (!quiet) console.log(`  ↷ ${script.id} exists`);
    return { skipped: true, videoPath, metaPath, dayDir };
  }

  if (!quiet) console.log(`  ▶ Rendering ${script.id} · ${script.hook.slice(0, 48)}…`);

  const scenesDir = join(dayDir, "scenes", script.id);
  await mkdir(scenesDir, { recursive: true });

  const bunnySvg = renderSynBunnyStandaloneSvg(512);
  const bunnyPng = join(dayDir, "syn-bunny.png");
  if (!(await fileExists(bunnyPng))) {
    await writeFile(join(dayDir, "syn-bunny.svg"), bunnySvg, "utf8");
    await renderSvgToPng(bunnySvg, bunnyPng);
  }
  clearSynBunnyCache();

  const scenePngPaths = [];
  for (let i = 0; i < job.scenes.length; i += 1) {
    const scene = job.scenes[i];
    const svg = renderSceneSvg(scene);
    const pngPath = join(scenesDir, `${String(i + 1).padStart(2, "0")}-${scene.id}.png`);
    await renderSvgToPng(svg, pngPath);
    scenePngPaths.push(pngPath);
    await writeFile(join(scenesDir, `${scene.id}.svg`), svg, "utf8");
  }

  const audioPath = await synthesizeVoiceover(job.voiceover, join(dayDir, "audio", script.id), DEFAULT_TTS_VOICE);
  await writeFile(join(dayDir, `${script.id}-voiceover.txt`), `${job.voiceover}\n`, "utf8");

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
    `VOICEOVER SCRIPT:\n${job.voiceover}\n`,
  ].join("\n");
  const metadataPath = join(dayDir, `${script.id}-youtube.txt`);
  await writeFile(metadataPath, metadataBody, "utf8");
  await writeFile(join(dayDir, `${script.id}-tiktok.txt`), script.tiktokCaption, "utf8");
  await writeFile(join(dayDir, `${script.id}-telegram.txt`), script.telegramCaption, "utf8");
  await writeFile(join(dayDir, `${script.id}-x.txt`), script.xCaption, "utf8");

  if (!quiet) logSummary({ videoPath, metadataPath, audioSec: composed.audioSec, totalSec: composed.totalSec, quiet: false });

  return { skipped: false, videoPath, metadataPath, dayDir, script, ...composed };
}

export async function renderLaunchDay(scripts, { force = false, quiet = false } = {}) {
  const results = [];
  for (const script of scripts) {
    results.push(await renderLaunchVideo(script, { force, quiet }));
  }
  return results;
}
