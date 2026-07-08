import { buildTitanIdentityLine } from "../config/titanGuidelines";
import { answerAegisSecurityPrivacyQuestion } from "../config/sentinelAegis";
import { hasTitanMemoryConsent, titanMemoryContextLine } from "./titanMemory";
import { softenTitanResponse } from "./titanGuardrails";
import { oracleRespondToMessage } from "./oracleCryptoBrain";
import type { Token } from "../data/tokens";

export type TimeBand = "morning" | "afternoon" | "evening" | "night";

export type DayMoodReply = "good" | "long" | "trading" | "rough";

export type OracleConversationContext = {
  operatorName: string;
  titanBotName: string;
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

const INTRO_OPERATOR_NAME_KEY = "synexus_operator_voice_name";
const LEGACY_INTRO_OPERATOR_NAME_KEY = "synexus_operator_display_name";

type ProfileLike = {
  display_name?: string | null;
  username?: string | null;
};

export function operatorNameForSpeech(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === "there") return null;
  return trimmed;
}

/** Titan chat / voice — display name or username from profile only (never email). */
export function resolveOperatorName(profile: ProfileLike | null | undefined, _email?: string | null): string {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) {
    return profile.username
      .trim()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return "there";
}

/** Operator Link UI label — may use email local-part; never spoken by Titan. */
export function resolveOperatorDisplayName(
  profile: ProfileLike | null | undefined,
  email?: string | null,
): string {
  const fromProfile = resolveOperatorName(profile);
  if (fromProfile !== "there") return fromProfile;
  if (email?.includes("@")) {
    const local = email.split("@")[0] ?? "";
    const label = local
      .replace(/[._-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ")
      .slice(0, 28);
    if (label) return label;
  }
  return "Operator";
}

/** Spoken once at boot — single line only (no commander follow-up). */
export function buildOracleIntroVoiceLine(
  _operatorName?: string | null,
  _titanBotName?: string,
): string {
  return "Welcome to the SyNexus.";
}

/** @deprecated Use buildOracleIntroVoiceLine() — kept for replay buttons that resolve name at call time. */
export const ORACLE_INTRO_VOICE_LINE = buildOracleIntroVoiceLine();

export function saveIntroOperatorName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "there") return;
  try {
    localStorage.setItem(INTRO_OPERATOR_NAME_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

/** Profile display name saved for boot voice — never email. */
export function resolveIntroOperatorName(): string | null {
  try {
    const stored = localStorage.getItem(INTRO_OPERATOR_NAME_KEY)?.trim();
    if (stored && stored !== "there") return stored;
    // Ignore legacy key — it may hold email-derived labels from older builds.
    localStorage.removeItem(LEGACY_INTRO_OPERATOR_NAME_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

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

function withOptionalName(name: string, namedLine: string, plainLine: string): string {
  const spoken = operatorNameForSpeech(name);
  return spoken ? namedLine.replace("{name}", spoken) : plainLine;
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

function oracleWelcomeLead(name: string, skipWelcomeLine?: boolean): string {
  if (skipWelcomeLine) {
    return "I'm listening — ask about a coin or tell me what you need.";
  }
  return withOptionalName(
    name,
    "Welcome to The Synexus, {name}. How may I be of service?",
    "Welcome to The Synexus. How may I be of service?",
  );
}

export function buildOpeningGreeting(
  ctx: OracleConversationContext,
  options?: { skipWelcomeLine?: boolean },
): string {
  const lead = oracleWelcomeLead(ctx.operatorName, options?.skipWelcomeLine);

  if (ctx.daysSinceLastVisit >= 3) {
    return `${lead} It's been a few days — your Sentinels stayed on post.`;
  }

  if (ctx.alertCount > 0) {
    return `${lead} I have ${ctx.alertCount} alert${ctx.alertCount === 1 ? "" : "s"} ready when you are.`;
  }

  if (ctx.watchlistCount > 0) {
    return `${lead} I'm watching ${ctx.watchlistCount} token${ctx.watchlistCount === 1 ? "" : "s"} on your list.`;
  }

  if (ctx.tokens.length > 0) {
    const memory = titanMemoryContextLine();
    return memory
      ? `${lead} ${memory.charAt(0).toUpperCase()}${memory.slice(1)}.`
      : `${lead} Ask me about any coin — I'll read live data, not guesses.`;
  }

  return lead;
}

export function buildFollowUpAfterMood(mood: DayMoodReply, ctx: OracleConversationContext): string {
  const { operatorName: name, alertCount, plan } = ctx;

  if (mood === "good") {
    return plan === "PRO"
      ? withOptionalName(
          name,
          "That's what I like to hear, {name}. I'll keep your Sentinels sharp — head to Pulse anytime for a full briefing from me.",
          "That's what I like to hear. I'll keep your Sentinels sharp — head to Pulse anytime for a full briefing from me.",
        )
      : withOptionalName(
          name,
          "Good to hear, {name}. I'll run the Sentinels while you're up — Synexus Pro lets me brief you personally when you're ready.",
          "Good to hear. I'll run the Sentinels while you're up — Synexus Pro lets me brief you personally when you're ready.",
        );
  }

  if (mood === "long") {
    return alertCount > 0
      ? withOptionalName(
          name,
          `Long days hit different, {name}. I've triaged your ${alertCount} alert${alertCount === 1 ? "" : "s"} — open Pulse when you want the short version from me.`,
          `Long days hit different. I've triaged your ${alertCount} alert${alertCount === 1 ? "" : "s"} — open Pulse when you want the short version from me.`,
        )
      : withOptionalName(
          name,
          "I get it, {name}. Rest your eyes — I'll watch the lanes. Ping me on Pulse if anything moves.",
          "I get it. Rest your eyes — I'll watch the lanes. Ping me on Pulse if anything moves.",
        );
  }

  if (mood === "trading") {
    return alertCount > 0
      ? withOptionalName(
          name,
          `Busy desk, {name}. ${alertCount} alert${alertCount === 1 ? " is" : "s are"} live — I can walk you through them on Pulse when you want.`,
          `Busy desk. ${alertCount} alert${alertCount === 1 ? " is" : "s are"} live — I can walk you through them on Pulse when you want.`,
        )
      : withOptionalName(
          name,
          "Markets don't sleep, {name}. Aegis is on security & privacy; Pulse on momentum — tell me what you're hunting.",
          "Markets don't sleep. Aegis is on security & privacy; Pulse on momentum — tell me what you're hunting.",
        );
  }

  return alertCount > 0
    ? withOptionalName(
        name,
        `Sorry it's been rough, {name}. I'll keep it simple — ${alertCount} alert${alertCount === 1 ? "" : "s"} need your eyes when you're ready.`,
        `Sorry it's been rough. I'll keep it simple — ${alertCount} alert${alertCount === 1 ? "" : "s"} need your eyes when you're ready.`,
      )
    : withOptionalName(
        name,
        "I'm here, {name}. Rough days happen. I'll filter the noise — you focus on what you can control.",
        "I'm here. Rough days happen. I'll filter the noise — you focus on what you can control.",
      );
}

export function reactToFreeText(text: string, ctx: OracleConversationContext): string {
  const brain = oracleRespondToMessage(text, ctx);
  if (brain) return brain;

  const lower = text.toLowerCase().trim();
  if (!lower) return "I'm listening. What's on your mind?";

  if (/^(hi|hello|hey|yo|sup)\b/.test(lower)) {
    if (wasIntroWelcomeSpoken()) {
      return "I'm here — what do you need?";
    }
    return withOptionalName(
      ctx.operatorName,
      `${getTimeGreeting(getTimeBand())}, {name}. Good to hear from you. How's your day going?`,
      `${getTimeGreeting(getTimeBand())}. Good to hear from you. How's your day going?`,
    );
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

  if (/alert|warning|danger|rug|scam|privacy|security|phish/.test(lower)) {
    if (/privacy|security|phish|seed|private key|my data/.test(lower)) {
      const aegis = answerAegisSecurityPrivacyQuestion(text);
      if (aegis) return aegis;
    }
    return ctx.alertCount > 0
      ? withOptionalName(
          ctx.operatorName,
          `I'm on it, {name}. You have ${ctx.alertCount} active alert${ctx.alertCount === 1 ? "" : "s"} — I'll break them down on Pulse.`,
          `I'm on it. You have ${ctx.alertCount} active alert${ctx.alertCount === 1 ? "" : "s"} — I'll break them down on Pulse.`,
        )
      : "No live alerts right now. I'll flag you the second something looks off.";
  }

  if (/thank|thanks|ty\b/.test(lower)) {
    return withOptionalName(ctx.operatorName, "Always, {name}. That's what I'm here for.", "Always. That's what I'm here for.");
  }

  if (/who are you|what are you/.test(lower)) {
    return buildTitanIdentityLine(ctx.titanBotName);
  }

  if (/what can you do|help me|capabilities/.test(lower)) {
    const memory = hasTitanMemoryConsent()
      ? "Personalized memory is on — I'll remember your favorites and risk style."
      : "Turn on personalized memory in chat settings if you want me to remember your preferences.";
    return softenTitanResponse(
      `${buildTitanIdentityLine(ctx.titanBotName)}\n\nLive market scans, scam analysis, Sentinel commands, and trading coaching — ${memory}`,
    );
  }

  return withOptionalName(
    ctx.operatorName,
    `I hear you, {name}. "${text}" — noted. Head to Pulse if you want a market read, or keep talking here.`,
    `"${text}" — noted. Head to Pulse if you want a market read, or keep talking here.`,
  );
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
