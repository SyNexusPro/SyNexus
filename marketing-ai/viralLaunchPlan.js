/**
 * SyNexus 7-Day Viral Launch Plan — day themes, volume targets, and KPIs.
 * Brand: SyNexus (strict). Community hub: Telegram.
 */

export const LAUNCH_GOAL = {
  videosTotal: "30–60 short-form videos",
  formats: "2–5 winning formats identified",
  platforms: "TikTok · YouTube Shorts · X · Reddit · Telegram",
  homeBase: "Telegram",
};

export const CONTENT_FORMATS = {
  ai_detection: {
    id: "ai_detection",
    label: "AI Detection Clip",
    visual: "dashboard scanning coins",
  },
  exposed_scam: {
    id: "exposed_scam",
    label: "Exposed Scam Format",
    visual: "storytelling + warning tone",
  },
  before_it_happens: {
    id: "before_it_happens",
    label: "Before It Happens",
    visual: "prediction-style hooks",
  },
  founder_story: {
    id: "founder_story",
    label: "Founder Story",
    visual: "emotional credibility",
  },
};

export const VIRAL_RULES = [
  "Post volume > perfection",
  "Kill weak formats fast",
  "Double down only on winners",
  'Every video must feel like "something important is happening"',
];

/** @type {import('./viralLaunchScripts.js').LaunchDay[]} */
export const LAUNCH_DAYS = [
  {
    day: 1,
    code: "hook",
    emoji: "🔴",
    title: "SET THE HOOK (LAUNCH DAY)",
    objective: "Make people understand SyNexus in 5 seconds.",
    videoTarget: { min: 6, max: 8 },
    visualStyle: "dark UI · glitch text · urgent tone",
    telegramAction: "Launch channel — post: SyNexus AI is now live",
    strategy: ["High-energy hooks", "Fake AI dashboard clips", "Launch CTA to synexus.pro"],
  },
  {
    day: 2,
    code: "fear",
    emoji: "🟠",
    title: "SCANDAL + FEAR DAY",
    objective: "Trigger emotional reaction (fear + curiosity).",
    videoTarget: { min: 5, max: 7 },
    visualStyle: "heavier storytelling · aggressive hooks",
    telegramAction: "Post rug / exit liquidity warning thread",
    strategy: ["Scams and manipulation focus", "Track retention on first strong video"],
    kpi: "Identify first video with strong retention",
  },
  {
    day: 3,
    code: "authority",
    emoji: "🟡",
    title: "AI AUTHORITY DAY",
    objective: 'Position SyNexus as "the system".',
    videoTarget: { min: 6, max: 8 },
    visualStyle: "dashboards · charts · AI scanning UI",
    telegramAction: "Demo paste → verdict flow",
    strategy: ["System language", "Sentinel / scan authority"],
  },
  {
    day: 4,
    code: "story",
    emoji: "🟢",
    title: "STORY + ORIGIN DAY",
    objective: "Build narrative trust.",
    videoTarget: { min: 4, max: 6 },
    visualStyle: "slower pacing · emotional tone",
    telegramAction: "Founder story + why SyNexus exists",
    strategy: ["Why I built SyNexus", "Pattern recognition origin"],
  },
  {
    day: 5,
    code: "experiment",
    emoji: "🔵",
    title: "VIRAL EXPERIMENT DAY",
    objective: "Mass testing hooks — find 1–2 viral formats.",
    videoTarget: { min: 10, max: 12 },
    visualStyle: "mix all formats · rapid A/B",
    telegramAction: "Poll: which hook hit hardest?",
    strategy: ["Test every hook variant", "Log performance in launch-state.json"],
    kpi: "Find 1–2 viral formats",
  },
  {
    day: 6,
    code: "double_down",
    emoji: "🟣",
    title: "DOUBLE DOWN DAY",
    objective: "Explode what worked — remake top performers.",
    videoTarget: { min: 6, max: 10 },
    visualStyle: "variations of top 2 winners",
    telegramAction: "Repost best clip + pin",
    strategy: ["5–10 variations per winner", "This is where growth usually spikes"],
    usesWinners: true,
  },
  {
    day: 7,
    code: "fomo",
    emoji: "⚫",
    title: "COMMUNITY + FOMO DAY",
    objective: "Convert attention into followers.",
    videoTarget: { min: 5, max: 7 },
    visualStyle: "live signals · Telegram push",
    telegramAction: "Hard push — private alerts · early users",
    strategy: ["Telegram home base", "X reposts", "Pin YouTube Short"],
  },
];

export function getLaunchDay(dayNumber) {
  const n = Math.min(7, Math.max(1, Number(dayNumber) || 1));
  return LAUNCH_DAYS[n - 1];
}

export function launchDayDir(dayNumber) {
  return `day-${String(dayNumber).padStart(2, "0")}`;
}

/** Calendar day index from LAUNCH_START_DATE env (YYYY-MM-DD) or today = day 1. */
export function currentLaunchDayIndex(now = new Date()) {
  const startRaw = process.env.LAUNCH_START_DATE?.trim();
  if (!startRaw) return 1;

  const start = new Date(`${startRaw}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 1;

  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(7, Math.max(1, diff + 1));
}

export function postStructureReminder() {
  return {
    hook: "0–2s — big claim or question",
    build: "2–10s — problem or system explanation",
    payoff: "10–20s — insight / demo / claim",
    loop: 'Loop ending — "No one is ready for what comes next…"',
  };
}
