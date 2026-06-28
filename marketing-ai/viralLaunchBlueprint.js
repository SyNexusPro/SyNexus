import { FEATURES as FLOW_STEPS } from "./videoBlueprint.js";

function truncateHeadline(text, max = 32) {
  const t = String(text || "").toUpperCase().replace(/[^\w\s·!?-]/g, "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildLaunchScenes(script) {
  const hookHeadline = truncateHeadline(script.headline, 28);
  const hookSub = script.hook.length > 60 ? `${script.hook.slice(0, 57)}…` : script.hook;

  return [
    {
      id: "intro",
      kicker: `DAY ${script.day} · SENTINEL`,
      headline: "SHOULD I BUY THIS?",
      sub: "Synexus · Paste · Scan · Decide",
      durationRatio: 0.18,
      visualStyle: script.visualStyle,
    },
    {
      id: "hook",
      kicker: "0–2s HOOK",
      headline: hookHeadline,
      sub: hookSub,
      durationRatio: 0.32,
      visualStyle: script.visualStyle,
    },
    {
      id: "flow",
      kicker: "2–10s BUILD",
      headline: "3 STEPS",
      steps: FLOW_STEPS,
      durationRatio: 0.28,
      visualStyle: script.visualStyle,
    },
    {
      id: "cta",
      kicker: script.loop?.slice(0, 40) || "PAYOFF",
      headline: "synexus.pro",
      sub: "Paste · Scan · Avoid or ape",
      durationRatio: 0.22,
      visualStyle: script.visualStyle,
    },
  ];
}

export function buildLaunchVideoJob(script) {
  return {
    script,
    voiceover: script.voiceover,
    metadata: {
      title: script.youtubeTitle,
      description: script.youtubeDescription,
      tags: script.youtubeTags,
      hook: script.hook,
      date: script.id,
    },
    scenes: buildLaunchScenes(script),
    id: script.id,
  };
}
