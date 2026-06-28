/**
 * Full scripted viral videos for Synexus 7-day launch.
 */

import { CONTENT_FORMATS } from "./viralLaunchPlan.js";
import {
  buildLaunchVoiceover,
  buildTelegramCaption,
  buildXCaption,
  buildTikTokCaption,
  buildYouTubeMeta,
} from "./marketingCopy.js";

function script({ id, day, format, hook, build, payoff, loop, visualStyle = "default", headline }) {
  const fields = { hook, build, payoff, loop, id };
  const voiceover = buildLaunchVoiceover(fields);
  const yt = buildYouTubeMeta({ ...fields, titleBase: `${hook.slice(0, 60)} · Synexus` });

  return {
    id,
    day,
    format,
    formatLabel: CONTENT_FORMATS[format]?.label || format,
    hook,
    build,
    payoff,
    loop,
    visualStyle,
    headline: headline || hook.split(".")[0]?.slice(0, 48) || "SHOULD I BUY THIS?",
    voiceover,
    tiktokCaption: buildTikTokCaption(fields),
    xCaption: buildXCaption(fields),
    telegramCaption: buildTelegramCaption(fields),
    youtubeTitle: yt.title,
    youtubeDescription: yt.description,
    youtubeTags: yt.tags,
  };
}

const DAY_1 = [
  script({ id: "d1-s1", day: 1, format: "exposed_scam", visualStyle: "glitch", headline: "GETTING PLAYED", hook: "Most crypto traders are getting played like this.", build: "They ape the chart. They never scan the mint. Rugs and exit liquidity drain wallets in minutes.", payoff: "Synexus paste any token and get Avoid, Watch, or OK before you sign.", loop: "No one is ready for what comes next." }),
  script({ id: "d1-s2", day: 1, format: "ai_detection", visualStyle: "dashboard", headline: "AI DETECTS SCAMS", hook: "I built an AI that detects scam coins early.", build: "It reads liquidity, whale wallets, and rug patterns in seconds—not after you're rekt.", payoff: "Synexus is live. Paste a mint. Get a plain English verdict.", loop: "Something important is happening right now." }),
  script({ id: "d1-s3", day: 1, format: "exposed_scam", visualStyle: "glitch", headline: "HOW RUGS HAPPEN", hook: "This is how rugs actually happen.", build: "Thin liquidity. Whale concentration. Fake hype. Then the chart goes vertical—and your exit is the product.", payoff: "Synexus flags the pattern before you connect a wallet.", loop: "Watch before it happens." }),
  script({ id: "d1-s4", day: 1, format: "ai_detection", visualStyle: "dashboard", headline: "SYNEXUS IS LIVE", hook: "Synexus is watching the market patterns.", build: "Sentinels scan risk, momentum, and whale moves across Solana tokens.", payoff: "Should I buy this? One paste. One answer.", loop: "The system is already running." }),
  script({ id: "d1-s5", day: 1, format: "before_it_happens", headline: "SHOULD I BUY THIS?", hook: "Should I buy this? Stop guessing.", build: "Paste any Solana token. Synexus scans it in seconds.", payoff: "Avoid. Watch. Or OK—in plain English.", loop: "Try it before the next pump." }),
  script({ id: "d1-s6", day: 1, format: "exposed_scam", visualStyle: "urgent", headline: "STOP APING BLIND", hook: "Stop aping blind on Solana.", build: "Every memecoin looks the same until the Sentinel read hits.", payoff: "Synexus is free to scan. Your wallet still signs every trade.", loop: "Paste first. Ape second." }),
  script({ id: "d1-s7", day: 1, format: "ai_detection", visualStyle: "dashboard", headline: "LAUNCH DAY", hook: "Synexus AI is now live.", build: "Non-custodial. No wallet connect required to scan.", payoff: "Risk score. Whales. Rug flags. Before you sign.", loop: "Link in bio. Telegram for live alerts." }),
];

const DAY_2 = [
  script({ id: "d2-s1", day: 2, format: "exposed_scam", visualStyle: "fear", headline: "LOSE EVERYTHING", hook: "This is how you lose everything in crypto.", build: "Chase green candles. Ignore wallet concentration. Hold through the dump.", payoff: "Synexus shows you Avoid before the timeline screams.", loop: "Exit liquidity is real." }),
  script({ id: "d2-s2", day: 2, format: "exposed_scam", visualStyle: "fear", headline: "EXIT LIQUIDITY", hook: "Exit liquidity is real—and here's how it works.", build: "Early wallets load up. Retail floods in. Whales exit into your buy.", payoff: "Paste the mint. Synexus reads top wallets and liquidity health.", loop: "Most coins are designed to drain you." }),
  script({ id: "d2-s3", day: 2, format: "exposed_scam", visualStyle: "glitch", headline: "DESIGNED TO DRAIN", hook: "Most coins are designed to drain you.", build: "Not every red flag is on the chart. Sentinels see what influencers won't say.", payoff: "Should I buy this? Get the answer in five seconds.", loop: "No one is ready for what comes next." }),
  script({ id: "d2-s4", day: 2, format: "before_it_happens", visualStyle: "fear", headline: "BEFORE THE DUMP", hook: "The dump always looks obvious after.", build: "Synexus tracks sharp pumps, thin liquidity, and whale exits in real time.", payoff: "Watch or Avoid—before you sign.", loop: "Scan first." }),
  script({ id: "d2-s5", day: 2, format: "exposed_scam", visualStyle: "fear", headline: "SCAM PATTERN", hook: "I've seen this scam pattern repeat every launch season.", build: "New mint. Fake volume. Paid shillers. Then silence.", payoff: "Synexus pattern scans catch it early.", loop: "Something important is happening." }),
  script({ id: "d2-s6", day: 2, format: "ai_detection", visualStyle: "dashboard", headline: "RUG FLAGS", hook: "Rug flags don't show up on the chart.", build: "They show up in liquidity, holder concentration, and Sentinel risk scores.", payoff: "Paste any token at synexus dot pro.", loop: "Don't be exit liquidity." }),
];

const DAY_3 = [
  script({ id: "d3-s1", day: 3, format: "ai_detection", visualStyle: "dashboard", headline: "THOUSANDS SCANNED", hook: "Synexus scans thousands of tokens in seconds.", build: "Guardian engine. Four Sentinel lanes. One plain English verdict.", payoff: "Avoid. Watch. OK.", loop: "The system sees what you can't." }),
  script({ id: "d3-s2", day: 3, format: "before_it_happens", visualStyle: "dashboard", headline: "EARLY PATTERNS", hook: "This AI tracks early movement patterns.", build: "Momentum, whale concentration, liquidity drift—fused into one read.", payoff: "Should I buy this? Synexus answers before you ape.", loop: "Watch before it happens." }),
  script({ id: "d3-s3", day: 3, format: "ai_detection", visualStyle: "authority", headline: "BEFORE PUMPS", hook: "Here's what the system sees before pumps.", build: "Volume spikes with few holders. Liquidity too thin for the hype.", payoff: "Synexus Sentinels flag it. You decide.", loop: "The next move is already forming." }),
  script({ id: "d3-s4", day: 3, format: "ai_detection", visualStyle: "dashboard", headline: "THE SYSTEM", hook: "This isn't a chart. It's a system.", build: "Aegis security. Guardian scoring. Oracle briefings on Pro.", payoff: "Free scan at synexus dot pro.", loop: "Something important is happening." }),
  script({ id: "d3-s5", day: 3, format: "ai_detection", visualStyle: "authority", headline: "SENTINEL GRID", hook: "Four Sentinels. One verdict.", build: "Aegis hunts scams. Pulse reads momentum. Titan shadows whales. Cipher fuses the signals.", payoff: "Paste a mint. Get Avoid or Watch in plain English.", loop: "No one is ready for what comes next." }),
  script({ id: "d3-s6", day: 3, format: "before_it_happens", visualStyle: "dashboard", headline: "PASTE SCAN DECIDE", hook: "Paste. Scan. Decide.", build: "Synexus is the command center for Solana risk—not your wallet.", payoff: "Try free. Pro unlocks Oracle and full Sentinel grid.", loop: "Link in bio." }),
];

const DAY_4 = [
  script({ id: "d4-s1", day: 4, format: "founder_story", visualStyle: "story", headline: "WHY I BUILT IT", hook: "Why I built Synexus.", build: "I kept watching the same scam patterns destroy people who never had a chance to scan first.", payoff: "So I built a system that answers one question: should I buy this?", loop: "It's live now." }),
  script({ id: "d4-s2", day: 4, format: "founder_story", visualStyle: "story", headline: "SAME PATTERNS", hook: "I kept seeing the same scam patterns.", build: "Fake hype. Thin liquidity. Whale exits. Every cycle.", payoff: "Synexus automates the read so you don't ape blind.", loop: "Paste before you sign." }),
  script({ id: "d4-s3", day: 4, format: "founder_story", visualStyle: "story", headline: "TRACK IT", hook: "So I built a system to track it.", build: "Not financial advice—a risk read before you connect Phantom.", payoff: "Free at synexus dot pro. Telegram for alerts.", loop: "Something important is happening." }),
  script({ id: "d4-s4", day: 4, format: "founder_story", visualStyle: "story", headline: "ONE QUESTION", hook: "One question changed how I trade.", build: "Should I buy this? Not maybe. Avoid, Watch, or OK.", payoff: "Synexus gives that answer in seconds.", loop: "Try it today." }),
  script({ id: "d4-s5", day: 4, format: "founder_story", visualStyle: "story", headline: "FOR REAL TRADERS", hook: "Built for people tired of being exit liquidity.", build: "Non-custodial. You sign every trade. We just show the risk first.", payoff: "Synexus is live.", loop: "No one is ready for what comes next." }),
];

const DAY_5_HOOKS = [
  "This coin pattern repeats every time.",
  "Watch this before it happens.",
  "The next move is already forming.",
  "They don't want you to scan the mint.",
  "This is what insiders check first.",
  "The chart lies. The Sentinel read doesn't.",
  "Aping without this is gambling.",
  "Three seconds. One verdict.",
  "Most traders skip this step.",
  "This is why rugs feel sudden.",
  "Paste the mint or stay blind.",
  "Synexus caught this before CT did.",
];

const DAY_5 = DAY_5_HOOKS.map((hook, i) =>
  script({
    id: `d5-s${i + 1}`,
    day: 5,
    format: i % 2 === 0 ? "before_it_happens" : "ai_detection",
    visualStyle: i % 3 === 0 ? "glitch" : "dashboard",
    hook,
    build: "Synexus scans liquidity, whales, and rug flags across Solana.",
    payoff: "Avoid. Watch. OK. Before you sign.",
    loop: "No one is ready for what comes next.",
  }),
);

const DAY_7 = [
  script({ id: "d7-s1", day: 7, format: "before_it_happens", visualStyle: "fomo", headline: "LIVE SIGNALS", hook: "Synexus is now tracking live signals.", build: "Sentinel alerts. Risk spikes. Whale moves.", payoff: "Private alerts are going into Telegram.", loop: "Only early users are seeing this." }),
  script({ id: "d7-s2", day: 7, format: "ai_detection", visualStyle: "fomo", headline: "TELEGRAM ALERTS", hook: "Private alerts are going into Telegram.", build: "Join the Synexus channel for launch drops and scan reminders.", payoff: "Should I buy this? Free at synexus dot pro.", loop: "Link in bio." }),
  script({ id: "d7-s3", day: 7, format: "before_it_happens", visualStyle: "fomo", headline: "EARLY USERS", hook: "Only early users are seeing this.", build: "The system is live. The audience is still small.", payoff: "Paste any token. Get the Sentinel read first.", loop: "Something important is happening." }),
  script({ id: "d7-s4", day: 7, format: "ai_detection", visualStyle: "fomo", headline: "JOIN NOW", hook: "If you're trading Solana without a scanner—you're late.", build: "Synexus answers should I buy this in plain English.", payoff: "Telegram for retention. App for scans.", loop: "No one is ready for what comes next." }),
  script({ id: "d7-s5", day: 7, format: "exposed_scam", visualStyle: "fomo", headline: "LAST CALL", hook: "Last call before the next meta shift.", build: "Risk-first trading is the edge retail never had.", payoff: "Synexus. Paste. Scan. Decide.", loop: "Try free today." }),
  script({ id: "d7-s6", day: 7, format: "ai_detection", visualStyle: "fomo", headline: "7 DAY LAUNCH", hook: "Seven days in. The system works.", build: "Thousands of scans. One question: should I buy this?", payoff: "Join Telegram. Scan at synexus dot pro.", loop: "This is just the start." }),
];

const SCRIPTS_BY_DAY = { 1: DAY_1, 2: DAY_2, 3: DAY_3, 4: DAY_4, 5: DAY_5, 7: DAY_7 };

export function getScriptsForDay(dayNumber, winners = []) {
  const day = Math.min(7, Math.max(1, Number(dayNumber) || 1));
  if (day === 6 && winners.length >= 1) return buildDoubleDownScripts(winners);
  if (day === 6) return buildDoubleDownScripts(getScriptsForDay(5).slice(0, 2));
  return SCRIPTS_BY_DAY[day] || DAY_1;
}

function buildDoubleDownScripts(winners) {
  const top = winners.slice(0, 2);
  const variations = [];
  const angles = [
    (h) => h,
    (h) => `Wait—${h.charAt(0).toLowerCase()}${h.slice(1)}`,
    (h) => `Nobody talks about this: ${h.charAt(0).toLowerCase()}${h.slice(1)}`,
    (h) => `POV: ${h.charAt(0).toLowerCase()}${h.slice(1)}`,
    (h) => `Real talk. ${h}`,
  ];
  for (let w = 0; w < top.length; w += 1) {
    const base = top[w];
    for (let v = 0; v < 5; v += 1) {
      variations.push(
        script({
          id: `d6-w${w + 1}-v${v + 1}`,
          day: 6,
          format: base.format || "ai_detection",
          visualStyle: base.visualStyle || "dashboard",
          hook: angles[v](base.hook),
          build: base.build,
          payoff: base.payoff,
          loop: base.loop,
          headline: `WINNER v${v + 1}`,
        }),
      );
    }
  }
  return variations;
}

export function allLaunchScripts() {
  return [1, 2, 3, 4, 5, 6, 7].flatMap((d) => getScriptsForDay(d));
}

export function totalScriptCount() {
  return allLaunchScripts().length;
}
