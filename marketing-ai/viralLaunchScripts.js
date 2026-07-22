/**
 * Full scripted viral videos for SyNexus 7-day launch.
 */

import { CONTENT_FORMATS } from "./viralLaunchPlan.js";
import {
  buildLaunchVoiceover,
  buildTelegramCaption,
  buildXCaption,
  buildTikTokCaption,
  buildYouTubeMeta,
} from "./marketingCopy.js";

const BADASS_LOOPS = [
  "Don't be exit liquidity.",
  "Scan first. Ape second.",
  "The chart lies. I don't.",
  "Paste it. Read it. Then decide.",
  "They want you blind. Don't give them that.",
  "One paste. One verdict. Move.",
  "Your wallet signs. My job is the read.",
  "Rug season doesn't sleep. Neither do I.",
];

function script({ id, day, format, hook, build, payoff, loop, visualStyle = "default", headline }) {
  const fields = { hook, build, payoff, loop, id };
  const voiceover = buildLaunchVoiceover(fields);
  const yt = buildYouTubeMeta(fields);

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
  script({ id: "d1-s1", day: 1, format: "exposed_scam", visualStyle: "glitch", headline: "YOU'RE BEING PLAYED", hook: "You're being played. Every single day.", build: "They show you green candles. They hide the mint, the whales, and the exit.", payoff: "Paste any token. SyNexus hits you with Avoid, Watch, or OK — before you sign.", loop: "Don't be exit liquidity." }),
  script({ id: "d1-s2", day: 1, format: "ai_detection", visualStyle: "dashboard", headline: "I SEE THE SCAM", hook: "I built an AI that sees scams before CT does.", build: "Liquidity. Wallet concentration. Rug patterns — fused in three seconds.", payoff: "SyNexus is live. Paste the mint. Get the read.", loop: "Scan first. Ape second." }),
  script({ id: "d1-s3", day: 1, format: "exposed_scam", visualStyle: "glitch", headline: "THIS IS THE RUG", hook: "This is exactly how rugs work.", build: "Thin pool. Fat wallets. Fake hype. Then your buy becomes their exit.", payoff: "SyNexus flags the pattern cold — before Phantom opens.", loop: "The chart lies. I don't." }),
  script({ id: "d1-s4", day: 1, format: "ai_detection", visualStyle: "dashboard", headline: "I'M WATCHING", hook: "SyNexus is already watching.", build: "Four Sentinels. One verdict. Risk, momentum, whales — live on Solana.", payoff: "Should I buy this? One paste. One answer.", loop: "Move with data. Not hope." }),
  script({ id: "d1-s5", day: 1, format: "before_it_happens", headline: "STOP GUESSING", hook: "Stop guessing. Start scanning.", build: "Paste any Solana mint. SyNexus reads it in seconds.", payoff: "Avoid. Watch. OK. Plain English. No cope.", loop: "Paste it. Read it. Then decide." }),
  script({ id: "d1-s6", day: 1, format: "exposed_scam", visualStyle: "urgent", headline: "NO MORE BLIND APES", hook: "No more blind apes.", build: "Every memecoin looks identical until the Sentinel read drops.", payoff: "Free scan. Your wallet still signs every trade.", loop: "They want you blind. Don't give them that." }),
  script({ id: "d1-s7", day: 1, format: "ai_detection", visualStyle: "dashboard", headline: "WE'RE LIVE", hook: "SyNexus Sentinel is live. Right now.", build: "Non-custodial. No wallet connect to scan. Just paste and read.", payoff: "Risk score. Whales. Rug flags. Before you sign.", loop: "Rug season doesn't sleep. Neither do I." }),
];

const DAY_2 = [
  script({ id: "d2-s1", day: 2, format: "exposed_scam", visualStyle: "fear", headline: "ZERO IN 60 SEC", hook: "This is how you go to zero in sixty seconds.", build: "Chase the pump. Ignore the wallets. Hold while they dump on you.", payoff: "SyNexus shows Avoid before the timeline screams.", loop: "Exit liquidity is real." }),
  script({ id: "d2-s2", day: 2, format: "exposed_scam", visualStyle: "fear", headline: "EXIT LIQUIDITY", hook: "You are exit liquidity. Unless you scan.", build: "Whales load. Retail floods in. They sell into your buy.", payoff: "Paste the mint. SyNexus reads top wallets and pool health.", loop: "Most coins are built to drain you." }),
  script({ id: "d2-s3", day: 2, format: "exposed_scam", visualStyle: "glitch", headline: "DESIGNED TO DRAIN", hook: "Most coins are designed to drain you.", build: "The chart won't show it. Sentinels will.", payoff: "Should I buy this? Five seconds. One verdict.", loop: "One paste. One verdict. Move." }),
  script({ id: "d2-s4", day: 2, format: "before_it_happens", visualStyle: "fear", headline: "BEFORE THE DUMP", hook: "The dump always looks obvious after.", build: "SyNexus tracks thin liquidity, whale exits, and fake momentum live.", payoff: "Watch or Avoid — before you sign.", loop: "Scan first." }),
  script({ id: "d2-s5", day: 2, format: "exposed_scam", visualStyle: "fear", headline: "SAME SCAM AGAIN", hook: "Same scam. Every launch season.", build: "New mint. Fake volume. Paid shills. Then silence.", payoff: "SyNexus pattern scans catch it early.", loop: "Your wallet signs. My job is the read." }),
  script({ id: "d2-s6", day: 2, format: "ai_detection", visualStyle: "dashboard", headline: "RUG FLAGS HIDDEN", hook: "Rug flags never show on the chart.", build: "They show in liquidity, holder concentration, and Sentinel scores.", payoff: "Paste any token at synexus dot pro.", loop: "Don't be exit liquidity." }),
];

const DAY_3 = [
  script({ id: "d3-s1", day: 3, format: "ai_detection", visualStyle: "dashboard", headline: "THOUSANDS SCANNED", hook: "SyNexus scans thousands of tokens in seconds.", build: "Guardian engine. Four Sentinel lanes. One plain English verdict.", payoff: "Avoid. Watch. OK.", loop: "The system sees what you can't." }),
  script({ id: "d3-s2", day: 3, format: "before_it_happens", visualStyle: "dashboard", headline: "EARLY PATTERNS", hook: "This AI tracks early movement patterns.", build: "Momentum, whale concentration, liquidity drift—fused into one read.", payoff: "Should I buy this? SyNexus answers before you ape.", loop: "Watch before it happens." }),
  script({ id: "d3-s3", day: 3, format: "ai_detection", visualStyle: "authority", headline: "BEFORE PUMPS", hook: "Here's what the system sees before pumps.", build: "Volume spikes with few holders. Liquidity too thin for the hype.", payoff: "SyNexus Sentinels flag it. You decide.", loop: "The next move is already forming." }),
  script({ id: "d3-s4", day: 3, format: "ai_detection", visualStyle: "dashboard", headline: "THE SYSTEM", hook: "This isn't a chart. It's a system.", build: "Aegis security. Guardian scoring. Oracle briefings on Pro.", payoff: "Free scan at synexus dot pro.", loop: "Something important is happening." }),
  script({ id: "d3-s5", day: 3, format: "ai_detection", visualStyle: "authority", headline: "SENTINEL GRID", hook: "Four Sentinels. One verdict.", build: "Aegis hunts scams. Pulse reads momentum. Titan shadows whales. Cipher fuses the signals.", payoff: "Paste a mint. Get Avoid or Watch in plain English.", loop: "No one is ready for what comes next." }),
  script({ id: "d3-s6", day: 3, format: "before_it_happens", visualStyle: "dashboard", headline: "PASTE SCAN DECIDE", hook: "Paste. Scan. Decide.", build: "SyNexus is the command center for Solana risk—not your wallet.", payoff: "Try free. Pro unlocks Oracle and full Sentinel grid.", loop: "Link in bio." }),
];

const DAY_4 = [
  script({ id: "d4-s1", day: 4, format: "founder_story", visualStyle: "story", headline: "WHY I BUILT IT", hook: "Why I built SyNexus.", build: "I kept watching the same scam patterns destroy people who never had a chance to scan first.", payoff: "So I built a system that answers one question: should I buy this?", loop: "It's live now." }),
  script({ id: "d4-s2", day: 4, format: "founder_story", visualStyle: "story", headline: "SAME PATTERNS", hook: "I kept seeing the same scam patterns.", build: "Fake hype. Thin liquidity. Whale exits. Every cycle.", payoff: "SyNexus automates the read so you don't ape blind.", loop: "Paste before you sign." }),
  script({ id: "d4-s3", day: 4, format: "founder_story", visualStyle: "story", headline: "TRACK IT", hook: "So I built a system to track it.", build: "Not financial advice—a risk read before you connect Phantom.", payoff: "Free at synexus dot pro. Telegram for alerts.", loop: "Something important is happening." }),
  script({ id: "d4-s4", day: 4, format: "founder_story", visualStyle: "story", headline: "ONE QUESTION", hook: "One question changed how I trade.", build: "Should I buy this? Not maybe. Avoid, Watch, or OK.", payoff: "SyNexus gives that answer in seconds.", loop: "Try it today." }),
  script({ id: "d4-s5", day: 4, format: "founder_story", visualStyle: "story", headline: "FOR REAL TRADERS", hook: "Built for people tired of being exit liquidity.", build: "Non-custodial. You sign every trade. We just show the risk first.", payoff: "SyNexus is live.", loop: "No one is ready for what comes next." }),
];

const DAY_5_HOOKS = [
  "This pattern repeats. Every. Single. Time.",
  "Watch this before you ape.",
  "The next rug is already loading.",
  "They don't want you scanning the mint.",
  "Insiders check this first. Do you?",
  "The chart lies. The Sentinel read doesn't.",
  "Aping without this is pure gambling.",
  "Three seconds. One verdict. No excuses.",
  "Most traders skip this step. Don't.",
  "Rugs feel sudden. They're not.",
  "Paste the mint or stay blind.",
  "SyNexus caught this before CT did.",
];

const DAY_5_BUILDS = [
  "SyNexus fuses liquidity, whales, and rug flags in one read.",
  "Four Sentinels. One verdict. Live on Solana.",
  "Paste the mint. Get Avoid, Watch, or OK — fast.",
  "I read the pool before you touch the chart.",
];

const DAY_5 = DAY_5_HOOKS.map((hook, i) =>
  script({
    id: `d5-s${i + 1}`,
    day: 5,
    format: i % 2 === 0 ? "before_it_happens" : "ai_detection",
    visualStyle: i % 3 === 0 ? "glitch" : "dashboard",
    hook,
    build: DAY_5_BUILDS[i % DAY_5_BUILDS.length],
    payoff: "Avoid. Watch. OK. Before you sign.",
    loop: BADASS_LOOPS[i % BADASS_LOOPS.length],
  }),
);

const DAY_7 = [
  script({ id: "d7-s1", day: 7, format: "before_it_happens", visualStyle: "fomo", headline: "LIVE SIGNALS", hook: "SyNexus is now tracking live signals.", build: "Sentinel alerts. Risk spikes. Whale moves.", payoff: "Private alerts are going into Telegram.", loop: "Only early users are seeing this." }),
  script({ id: "d7-s2", day: 7, format: "ai_detection", visualStyle: "fomo", headline: "TELEGRAM ALERTS", hook: "Private alerts are going into Telegram.", build: "Join the SyNexus channel for launch drops and scan reminders.", payoff: "Should I buy this? Free at synexus dot pro.", loop: "Link in bio." }),
  script({ id: "d7-s3", day: 7, format: "before_it_happens", visualStyle: "fomo", headline: "EARLY USERS", hook: "Only early users are seeing this.", build: "The system is live. The audience is still small.", payoff: "Paste any token. Get the Sentinel read first.", loop: "Something important is happening." }),
  script({ id: "d7-s4", day: 7, format: "ai_detection", visualStyle: "fomo", headline: "JOIN NOW", hook: "If you're trading Solana without a scanner—you're late.", build: "SyNexus answers should I buy this in plain English.", payoff: "Telegram for retention. App for scans.", loop: "No one is ready for what comes next." }),
  script({ id: "d7-s5", day: 7, format: "exposed_scam", visualStyle: "fomo", headline: "LAST CALL", hook: "Last call before the next meta shift.", build: "Risk-first trading is the edge retail never had.", payoff: "SyNexus. Paste. Scan. Decide.", loop: "Try free today." }),
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
