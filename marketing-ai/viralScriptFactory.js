/**
 * Viral script factory — SyNexus Content System v1.0 formula.
 */

import {
  SHOCK_HOOKS,
  CURIOSITY_TITLES,
  THUMBNAIL_WORDS,
  PROBLEMS,
  SOLUTIONS,
  SYNEXUS_DEMO,
  TEASES,
  primaryCta,
  seedFrom,
  pick,
} from "./viralContentSystem.js";
import {
  buildTelegramCaption,
  buildXCaption,
  buildTikTokCaption,
  buildYouTubeMeta,
} from "./marketingCopy.js";

function truncateHeadline(text, max = 28) {
  const t = String(text || "").toUpperCase().replace(/[^\w\s!?-]/g, "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildFormulaVoiceover({ shock, problem, solution, synexus, tease, cta }, { long = false } = {}) {
  const parts = [
    shock,
    problem,
    solution,
    synexus,
    tease,
    cta,
    "Not financial advice.",
  ];
  const max = long ? 1400 : 720;
  return parts.join(" ").replace(/\s+/g, " ").slice(0, max);
}

function baseScript({ id, day, slot = 0, long = false, overrides = {} }) {
  const seed = seedFrom(`${id}-${day}-${slot}`);
  const shock = overrides.shock || pick(SHOCK_HOOKS, seed);
  const problem = overrides.problem || pick(PROBLEMS, seed + 1);
  const solution = overrides.solution || pick(SOLUTIONS, seed + 2);
  const synexus = overrides.synexus || pick(SYNEXUS_DEMO, seed + 3);
  const tease = overrides.tease || pick(TEASES, seed + 4);
  const cta = overrides.cta || primaryCta(seed);
  const thumb = overrides.thumbnailText || pick(THUMBNAIL_WORDS, seed + 5);
  const title = overrides.youtubeTitle || pick(CURIOSITY_TITLES, seed + 6);

  const hook = shock;
  const build = problem;
  const payoff = `${solution} ${synexus}`;
  const loop = tease;

  const fields = { hook, build, payoff, loop, id };
  const voiceover = buildFormulaVoiceover({ shock, problem, solution, synexus, tease, cta }, { long });
  const yt = buildYouTubeMeta({ ...fields, titleBase: title });

  const visualStyles = ["glitch", "fear", "dashboard", "authority", "fomo"];
  const visualStyle = visualStyles[seed % visualStyles.length];

  return {
    id,
    day,
    slot,
    format: long ? "long_form" : "viral_short",
    formatLabel: long ? "Long-form (90s)" : "Viral Short",
    hook,
    build,
    payoff,
    loop,
    shock,
    problem,
    solution,
    synexus,
    tease,
    cta,
    formula: { shock, problem, solution, synexus, tease, cta },
    visualStyle,
    headline: truncateHeadline(thumb),
    thumbnailText: thumb,
    voiceover,
    tiktokCaption: buildTikTokCaption(fields),
    xCaption: buildXCaption(fields),
    telegramCaption: buildTelegramCaption(fields),
    youtubeTitle: yt.title,
    youtubeDescription: [
      yt.description,
      "",
      cta,
    ].join("\n"),
    youtubeTags: yt.tags,
    long,
  };
}

/** One viral Short for a daily slot (0–2). */
export function generateDailyShort({ dateKey, slot = 0 }) {
  const id = `v${dateKey.replace(/-/g, "")}-s${slot + 1}`;
  return baseScript({ id, day: 0, slot, long: false });
}

/** One long-form video per day (~90s target). */
export function generateDailyLong({ dateKey }) {
  const id = `v${dateKey.replace(/-/g, "")}-long`;
  return baseScript({
    id,
    day: 0,
    slot: 3,
    long: true,
    overrides: {
      shock: "I tested an AI crypto assistant for thirty days — here's what actually happened.",
      problem: "Most traders still ape blind. Charts lie. Wallets don't.",
      solution: "Every trade needs one question answered first: should I buy this?",
      synexus: "SyNexus fuses Sentinel lanes into Avoid, Watch, or OK — before you sign. Pro adds Oracle briefings and full grid refresh.",
      tease: "Next: the scam pattern that repeats every launch season.",
    },
  });
}

/** Full daily pack: 3 Shorts + 1 long-form + thumbnails metadata. */
export function generateDailyViralPack(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;

  const shorts = [0, 1, 2].map((slot) => generateDailyShort({ dateKey, slot }));
  const longForm = generateDailyLong({ dateKey });

  return {
    version: "1.0",
    dateKey,
    shorts,
    longForm,
    thumbnails: [...shorts, longForm].map((s) => ({
      scriptId: s.id,
      words: s.thumbnailText,
      title: s.youtubeTitle,
    })),
  };
}

export { truncateHeadline, buildFormulaVoiceover };
