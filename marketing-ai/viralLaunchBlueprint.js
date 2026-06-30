/**
 * Retention-first scene builder — SyNexus Viral Content System v1.0
 * Never leave one beat on screen longer than maxBeatSec.
 */

import { EDITING, VISUAL_ROTATION, seedFrom } from "./viralContentSystem.js";
import { FEATURES as FLOW_STEPS } from "./videoBlueprint.js";

function truncateHeadline(text, max = 32) {
  const t = String(text || "").toUpperCase().replace(/[^\w\s·!?-]/g, "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function phaseContent(script, phase) {
  const f = script.formula || script;
  switch (phase) {
    case "shock":
      return { headline: script.thumbnailText || truncateHeadline(f.shock, 20), sub: f.shock || script.hook };
    case "problem":
      return { headline: "THE PROBLEM", sub: f.problem || script.build };
    case "solution":
      return { headline: "THE FIX", sub: f.solution || script.payoff?.split(".")[0] };
    case "synexus":
      return { headline: "SYNEXUS", sub: f.synexus || script.payoff };
    case "tease":
      return { headline: "YOUR MOVE", sub: f.tease || script.loop };
    case "cta":
      return { headline: "synexus.pro", sub: f.cta || "Download SyNexus · free scan" };
    default:
      return { headline: truncateHeadline(script.headline), sub: script.hook };
  }
}

const PHASE_SEQUENCE_SHORT = [
  "shock", "shock",
  "problem", "problem", "problem",
  "solution", "solution",
  "synexus", "synexus", "synexus",
  "tease", "cta",
];

const PHASE_SEQUENCE_LONG = [
  ...PHASE_SEQUENCE_SHORT,
  "problem", "solution", "synexus", "synexus",
  "shock", "problem", "solution", "synexus",
  "tease", "cta",
];

export function beatCountForDuration(totalSec, maxBeatSec = EDITING.maxBeatSec) {
  return Math.max(8, Math.ceil(totalSec / maxBeatSec));
}

export function buildRetentionScenes(script, totalSec, { long = false } = {}) {
  const maxBeat = Number(process.env.VIDEO_BEAT_SEC) || EDITING.maxBeatSec;
  const beatCount = beatCountForDuration(totalSec, maxBeat);
  const sequence = long ? PHASE_SEQUENCE_LONG : PHASE_SEQUENCE_SHORT;
  const seed = seedFrom(script.id || "synexus");
  const ratio = 1 / beatCount;

  const scenes = [];
  for (let i = 0; i < beatCount; i += 1) {
    const phase = sequence[i % sequence.length];
    const content = phaseContent(script, phase);
    const visualStyle = VISUAL_ROTATION[(seed + i) % VISUAL_ROTATION.length];

    scenes.push({
      id: phase === "synexus" && i % 3 === 0 ? "flow" : phase === "cta" ? "cta" : "hook",
      beat: i + 1,
      phase,
      kicker: phase.toUpperCase(),
      headline: content.headline,
      sub: content.sub?.length > 72 ? `${content.sub.slice(0, 69)}…` : content.sub,
      durationRatio: ratio,
      visualStyle,
      steps: phase === "synexus" && i % 4 === 0 ? FLOW_STEPS : undefined,
    });
  }

  return scenes;
}

/** @deprecated use buildRetentionScenes after audio duration known */
export function buildLaunchScenes(script) {
  return buildRetentionScenes(script, EDITING.targetShortSec, { long: script.long });
}

export function buildLaunchVideoJob(script, totalSec) {
  const duration = totalSec || (script.long ? EDITING.targetLongSec : EDITING.targetShortSec);
  return {
    script,
    voiceover: script.voiceover,
    metadata: {
      title: script.youtubeTitle,
      description: script.youtubeDescription,
      tags: script.youtubeTags,
      hook: script.hook,
      date: script.id,
      thumbnailText: script.thumbnailText,
    },
    scenes: buildRetentionScenes(script, duration, { long: script.long }),
    id: script.id,
  };
}
