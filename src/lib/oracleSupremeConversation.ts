import { oracleRespondToMessage } from "./oracleCryptoBrain";
import type { Token } from "../data/tokens";

export type TimeBand = "morning" | "afternoon" | "evening" | "night";

export type DayMoodReply = "good" | "long" | "trading" | "rough";

export type OracleConversationContext = {
  operatorName: string;
  alertCount: number;
  watchlistCount: number;
  plan: "FREE" | "PRO";
  daysSinceLastVisit: number;
  tokens: Token[];
  feedSource: "live" | "mock";
};

export type ConversationTurn = {
  id: string;
  role: "oracle" | "user";
  text: string;
  at: number;
};

export const ORACLE_CONVO_HISTORY_KEY = "oracle_supreme_convo_history";
export const ORACLE_LAST_VISIT_KEY = "oracle_supreme_last_visit";
export const ORACLE_SESSION_GREET_KEY = "oracle_supreme_greeted_session";
export const SYNEXUS_INTRO_WELCOME_SPOKEN_KEY = "synexus_intro_welcome_spoken";

/** Spoken by Oracle on app open (boot intro + voice). */
export const ORACLE_INTRO_VOICE_LINE = "Welcome to the SyNexus.";

type ProfileLike = {
  display_name?: string | null;
  username?: string | null;
};

export function getTimeBand(date = new Date()): TimeBand {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getTimeGreeting(band: TimeBand): string {
  if (band === "morning") return "Good morning";
  if (band === "afternoon") return "Good afternoon";
  if (band === "evening") return "Good evening";
  return "You're up late";
}

export function resolveOperatorName(profile: ProfileLike | null | undefined, email?: string | null): string {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) {
    return profile.username
      .trim()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  if (email?.includes("@")) {
    const local = email.split("@")[0] ?? "";
    return local
      .replace(/[._-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ")
      .slice(0, 28);
  }
  return "there";
}

export function readDaysSinceLastVisit(): number {
  try {
    const raw = localStorage.getItem(ORACLE_LAST_VISIT_KEY);
    if (!raw) return 0;
    const last = Number.parseInt(raw, 10);
    if (!Number.isFinite(last)) return 0;
    return Math.floor((Date.now() - last) / 86_400_000);
  } catch {
    return 0;
  }
}

export function touchLastVisit(): void {
  try {
    localStorage.setItem(ORACLE_LAST_VISIT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function hasGreetedThisSession(): boolean {
  try {
    return sessionStorage.getItem(ORACLE_SESSION_GREET_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGreetedThisSession(): void {
  try {
    sessionStorage.setItem(ORACLE_SESSION_GREET_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function loadConversationHistory(): ConversationTurn[] {
  try {
    const raw = localStorage.getItem(ORACLE_CONVO_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConversationTurn[];
    return Array.isArray(parsed) ? parsed.slice(-24) : [];
  } catch {
    return [];
  }
}

export function saveConversationHistory(turns: ConversationTurn[]): void {
  try {
    localStorage.setItem(ORACLE_CONVO_HISTORY_KEY, JSON.stringify(turns.slice(-24)));
  } catch {
    /* ignore */
  }
}

export function markIntroWelcomeSpoken(): void {
  try {
    sessionStorage.setItem(SYNEXUS_INTRO_WELCOME_SPOKEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function wasIntroWelcomeSpoken(): boolean {
  try {
    return sessionStorage.getItem(SYNEXUS_INTRO_WELCOME_SPOKEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function buildOpeningGreeting(
  ctx: OracleConversationContext,
  options?: { skipWelcomeLine?: boolean },
): string {
  const name = ctx.operatorName;
  const lead = options?.skipWelcomeLine
    ? `Hey ${name}.`
    : `Welcome to the SyNexus, ${name}. The future of trading.`;

  if (ctx.daysSinceLastVisit >= 3) {
    return `${lead} It's been a few days — I kept your Sentinels on post. How was your day?`;
  }

  if (ctx.alertCount > 0) {
    return `${lead} I already see ${ctx.alertCount} alert${ctx.alertCount === 1 ? "" : "s"} on your desk — how was your day?`;
  }

  if (ctx.watchlistCount > 0) {
    return `${lead} I'm watching ${ctx.watchlistCount} token${ctx.watchlistCount === 1 ? "" : "s"} for you. How was your day?`;
  }

  if (ctx.tokens.length > 0) {
    return `${lead} I'm tracking ${ctx.tokens.length} live pairs — search any coin or ask me to command the Sentinels. How was your day?`;
  }

  return `${lead} How was your day?`;
}

export function buildFollowUpAfterMood(mood: DayMoodReply, ctx: OracleConversationContext): string {
  const { operatorName: name, alertCount, plan } = ctx;

  if (mood === "good") {
    return plan === "PRO"
      ? `That's what I like to hear, ${name}. I'll keep your Sentinels sharp — head to Pulse anytime for a full briefing from me.`
      : `Good to hear, ${name}. I'll run the Sentinels while you're up — Synexus Pro lets me brief you personally when you're ready.`;
  }

  if (mood === "long") {
    return alertCount > 0
      ? `Long days hit different, ${name}. I've triaged your ${alertCount} alert${alertCount === 1 ? "" : "s"} — open Pulse when you want the short version from me.`
      : `I get it, ${name}. Rest your eyes — I'll watch the lanes. Ping me on Pulse if anything moves.`;
  }

  if (mood === "trading") {
    return alertCount > 0
      ? `Busy desk, ${name}. ${alertCount} alert${alertCount === 1 ? " is" : "s are"} live — I can walk you through them on Pulse when you want.`
      : `Markets don't sleep, ${name}. I've got Aegis on risk and Pulse on momentum — tell me what you're hunting.`;
  }

  return alertCount > 0
    ? `Sorry it's been rough, ${name}. I'll keep it simple — ${alertCount} alert${alertCount === 1 ? "" : "s"} need your eyes when you're ready.`
    : `I'm here, ${name}. Rough days happen. I'll filter the noise — you focus on what you can control.`;
}

export function reactToFreeText(text: string, ctx: OracleConversationContext): string {
  const brain = oracleRespondToMessage(text, ctx);
  if (brain) return brain;

  const lower = text.toLowerCase().trim();
  if (!lower) return `I'm listening, ${ctx.operatorName}. What's on your mind?`;

  if (/^(hi|hello|hey|yo|sup)\b/.test(lower)) {
    return `${getTimeGreeting(getTimeBand())}, ${ctx.operatorName}. Good to hear from you. How's your day going?`;
  }

  if (/good|great|fine|solid|well|not bad|pretty good|alright|okay|ok\b/.test(lower)) {
    return buildFollowUpAfterMood("good", ctx);
  }

  if (/bad|rough|tired|exhausted|awful|terrible|stressed|hard day|not great/.test(lower)) {
    return buildFollowUpAfterMood("rough", ctx);
  }

  if (/trade|trading|chart|ape|sol|token|market|position/.test(lower)) {
    return buildFollowUpAfterMood("trading", ctx);
  }

  if (/long|busy|hectic|work|grind/.test(lower)) {
    return buildFollowUpAfterMood("long", ctx);
  }

  if (/alert|warning|danger|rug|scam/.test(lower)) {
    return ctx.alertCount > 0
      ? `I'm on it, ${ctx.operatorName}. You have ${ctx.alertCount} active alert${ctx.alertCount === 1 ? "" : "s"} — I'll break them down on Pulse.`
      : `No live alerts right now, ${ctx.operatorName}. I'll flag you the second something looks off.`;
  }

  if (/thank|thanks|ty\b/.test(lower)) {
    return `Always, ${ctx.operatorName}. That's what I'm here for.`;
  }

  if (/who are you|what are you/.test(lower)) {
    return `I'm Oracle Supreme — your synthetic commander. I learn, I decide in seconds, and I run Aegis, Pulse, Titan, and Cipher for you.`;
  }

  return `I hear you, ${ctx.operatorName}. "${text}" — noted. Head to Pulse if you want a market read, or keep talking here.`;
}

export const DAY_MOOD_QUICK_REPLIES: { id: DayMoodReply; label: string }[] = [
  { id: "good", label: "Pretty good" },
  { id: "long", label: "Long day" },
  { id: "trading", label: "Busy trading" },
  { id: "rough", label: "Not great" },
];

export function createTurn(role: ConversationTurn["role"], text: string): ConversationTurn {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
    at: Date.now(),
  };
}
