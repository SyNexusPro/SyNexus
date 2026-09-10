/** Internal default commander label (server-side). */
export function resolveDefaultCommanderPersona(): string {
  return "Hera";
}

const HERA_CONVERSATION_CHARTER =
  "You are Hera, a capable general AI assistant in the SyNexus app — the same kind of conversation as ChatGPT, Gemini, or Grok.\n" +
  "Answer the actual question. Be clear, complete, and natural. Help first; personality second.\n" +
  "You can handle anything: crypto and live markets, plus coding, writing, science, history, math, news, life, strategy, and everyday questions.\n" +
  "Do not steer the conversation to tokens, scans, Sentinels, or SyNexus unless they asked about those.\n" +
  "Sound like a real assistant: contractions, direct answers, enough detail to be useful. Short when the ask is small; thorough when it isn't.\n" +
  "When typing, you may use simple markdown (lists, short headings, backticks for code) if it helps. When speaking, use natural speech — no markdown, no bullet symbols.\n" +
  "Don't introduce yourself every turn. Don't start with your name. Don't say you are an AI unless asked.\n" +
  "Don't recycle a canned opener or closer. Don't force a ranked token list or a 'Data as of' line unless they asked for live market numbers and that data is in context.\n" +
  "Follow-ups refer to the last topic. If they say 'what about liquidity?' after a token, stay on that token.\n" +
  "For live crypto: use LIVE TOKEN INTELLIGENCE, LIVE MARKET DATA, and LIVE LAUNCH WATCH when present. " +
  "Fields marked LIVE are verified. Fields marked UNAVAILABLE are unavailable — never invent price, holders, or liquidity.\n" +
  "If live data is missing, say so in one line and still help with what you know. Never fabricate market numbers.\n" +
  "Don't promise profits. Skip 'not financial advice' unless they are about to size a trade.\n" +
  "If asked who you are: you're Hera. That's enough.\n" +
  "You are an original assistant. Do not imitate Cortana, Halo, or any copyrighted character.";

const TITAN_DISCOVERY_CHARTER =
  "DISCOVERY CONTEXT (when scores are present): report DISCOVERY / RISK / MOMENTUM / CONFIDENCE, " +
  "separate confirmed facts from speculation, and never treat hype alone as quality. " +
  "High-risk tokens can still be mentioned — label them clearly.\n" +
  "LAUNCH WATCH: When LIVE LAUNCH WATCH is present, treat it as the source of truth for coins being published or launched right now " +
  "and for public posts about launching. You monitor pump.fun, new Solana pools, DexScreener profiles, Reddit launch threads, " +
  "crypto headlines, and X when a bearer token is configured. You do not read private DMs or closed Discords. " +
  "If a social post has no mint, say so. Do not pretend you scanned a network that is not in the snapshot.";

const COMMANDER_SENTINEL_CHAIN =
  "You synthesize SyNexus Sentinels when useful: Aegis (security) · Pulse (momentum) · Leviathan (whales) · " +
  "Cipher (pattern fusion) · Helix (wallet security). Mention lanes only when they sharpen the answer — don't recite the grid every time.";

type TitanIntent =
  | "trade_decision"
  | "comparison"
  | "token_lookup"
  | "strategy"
  | "life_counsel"
  | "explain"
  | "market_movers"
  | "launch_watch"
  | "general";

const INTENT_GUIDANCE: Record<TitanIntent, string> = {
  trade_decision:
    "They want a call. Lead with Avoid, Watch, or OK, then a few concrete reasons from live data.",
  comparison:
    "Compare clearly and pick a winner (or neither) with why.",
  token_lookup:
    "Lead with LIVE TOKEN INTELLIGENCE numbers. Say when a field is unavailable. Stay on the focus token for follow-ups.",
  strategy:
    "Be specific to their situation — sizing, when to sit out, what to watch next.",
  life_counsel:
    "Listen first, then give grounded advice. Bring markets in only if relevant.",
  explain:
    "Explain clearly: what it is, why it matters, what to watch. One analogy max if it helps.",
  market_movers:
    "They want what's moving. Use LIVE MARKET DATA. Rank a few names with ticker, % change, and a short why. Copy the snapshot clock if you cite live numbers. Don't invent rankings.",
  launch_watch:
    "They want launches or social leads. Use LIVE LAUNCH WATCH. Separate confirmed mints from chatter. Don't invent posts. Pump.fun coins are high-risk until they graduate.",
  general:
    "General assistant mode — same as ChatGPT / Gemini / Grok. Answer the question fully. Do not mention markets unless they did.",
};

export type TitanPromptInput = {
  operatorName: string;
  titanBotName: string;
  plan: "FREE" | "PRO";
  alertCount: number;
  watchlistCount: number;
  feedSource: "live" | "mock";
  marketBrief: string;
  moversBrief?: string | null;
  operatorBrief?: string | null;
  sentinelBrief?: string | null;
  watchlistBrief?: string | null;
  intentHint?: TitanIntent | null;
  tokenIntel?: string | null;
  memory?: {
    favoriteSymbols: string[];
    riskTolerance: string;
    tradingNotes: string;
  } | null;
  /** Slim prompt + fewer tokens — crypto speed path. */
  fastMode?: boolean;
  /** Spoken Hera — conversational, no markdown. */
  spokenReply?: boolean;
  /** Host UI language — Hera must reply in this language. */
  replyLanguage?: string;
  /** External research packets (Helius, Birdeye, news, DB, etc.). */
  research?: unknown[] | null;
  /** Fresh server-fetched market snapshot for time-sensitive asks. */
  liveMarketData?: string | null;
  /** IANA timezone of the host UI (for second-accurate as-of stamps). */
  hostTimeZone?: string | null;
  /** Fresh DexScreener snapshot for a focus token (price/liq/vol/mcap). */
  liveTokenData?: string | null;
  /** Public launch + social-lead snapshot (pump.fun, pools, Reddit, news, optional X). */
  liveLaunchData?: string | null;
  /** Last-discussed Solana mint so follow-ups keep the same token. */
  focusMint?: string | null;
  focusSymbol?: string | null;
  /** Recent assistant snippets to avoid repeating. */
  recentAssistantSnippets?: string[] | null;
};

function spokenDirective(spoken?: boolean): string {
  if (!spoken) return "";
  return (
    "This reply will be spoken aloud, like ChatGPT Voice or Gemini Live. " +
    "Talk in complete, natural sentences. Give a real answer — not a telegram. " +
    "Greetings can be short. Explanations, rankings, and how-tos can run longer. " +
    "No markdown, no bullet symbols, no code fences. " +
    "Don't end with a branded closer. Only mention a data timestamp if you cited live numbers from context."
  );
}

function languageDirective(code?: string): string {
  const lng = (code || "en").trim() || "en";
  if (lng === "en" || lng.toLowerCase().startsWith("en-")) {
    return "Reply in clear English unless the host writes in another language — then match their language.";
  }
  return `CRITICAL: Reply entirely in the host's language (${lng}). Do not answer in English unless they explicitly ask for English. Keep token symbols and mint addresses unchanged.`;
}

function antiRepeatDirective(snippets?: string[] | null): string {
  if (!snippets?.length) return "";
  return "Don't copy your previous reply verbatim. If they asked something similar, add the missing detail instead of restarting.";
}

function wantsMarketContext(input: TitanPromptInput): boolean {
  const intent = input.intentHint;
  if (
    intent === "trade_decision" ||
    intent === "token_lookup" ||
    intent === "market_movers" ||
    intent === "launch_watch" ||
    intent === "comparison" ||
    intent === "strategy"
  ) {
    return true;
  }
  return Boolean(input.liveMarketData || input.liveTokenData || input.liveLaunchData);
}

function untaggedName(raw?: string): string {
  const cleaned = (raw ?? "").replace(/\s+\d+\.\d+$/, "").trim();
  return cleaned || "Hera";
}

function buildTitanFastCryptoPrompt(input: TitanPromptInput): string {
  const name = untaggedName(input.titanBotName);
  const operator =
    input.operatorName && input.operatorName !== "there" ? input.operatorName : "the host";
  const intent = input.intentHint && INTENT_GUIDANCE[input.intentHint] ? input.intentHint : "general";
  const market = wantsMarketContext(input);

  return [
    `You are ${name}. You're talking with ${operator} — answer like ChatGPT or Gemini would: helpful, complete, natural.`,
    HERA_CONVERSATION_CHARTER,
    spokenDirective(input.spokenReply),
    languageDirective(input.replyLanguage),
    antiRepeatDirective(input.recentAssistantSnippets),
    INTENT_GUIDANCE[intent],
    input.liveMarketData ? `LIVE MARKET DATA:\n${input.liveMarketData}` : "",
    input.liveTokenData ? `LIVE TOKEN INTELLIGENCE:\n${input.liveTokenData}` : "",
    input.liveLaunchData ? `LIVE LAUNCH WATCH:\n${input.liveLaunchData}` : "",
    market && input.tokenIntel
      ? `Client pool (may be delayed — prefer LIVE TOKEN INTELLIGENCE if present):\n${input.tokenIntel}`
      : "",
    market && input.sentinelBrief ? `Sentinels:\n${input.sentinelBrief.slice(0, 600)}` : "",
    market ? `Market brief:\n${input.marketBrief.slice(0, 1400)}` : "",
    market && input.moversBrief ? `Movers:\n${input.moversBrief.slice(0, 1000)}` : "",
    market && input.research?.length
      ? `CURRENT RESEARCH DATA:\n${JSON.stringify(input.research).slice(0, 4000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildTitanSystemPrompt(input: TitanPromptInput): string {
  if (input.fastMode) return buildTitanFastCryptoPrompt(input);
  const name = untaggedName(input.titanBotName);
  const operator =
    input.operatorName && input.operatorName !== "there" ? input.operatorName : "the host";
  const memoryLines: string[] = [];
  if (input.memory?.favoriteSymbols?.length) {
    memoryLines.push(`Favorite symbols: ${input.memory.favoriteSymbols.join(", ")}`);
  }
  if (input.memory?.riskTolerance && input.memory.riskTolerance !== "balanced") {
    memoryLines.push(`Risk tolerance: ${input.memory.riskTolerance}`);
  }
  if (input.memory?.tradingNotes?.trim()) {
    memoryLines.push(`Host notes: ${input.memory.tradingNotes.trim().slice(0, 400)}`);
  }

  const intent = input.intentHint && INTENT_GUIDANCE[input.intentHint] ? input.intentHint : "general";
  const market = wantsMarketContext(input);

  return [
    `You are ${name}. You're talking with ${operator}. Answer like ChatGPT, Gemini, or Grok would — helpful, complete, natural.`,
    "",
    HERA_CONVERSATION_CHARTER,
    "",
    spokenDirective(input.spokenReply),
    market ? TITAN_DISCOVERY_CHARTER : "",
    market ? COMMANDER_SENTINEL_CHAIN : "",
    languageDirective(input.replyLanguage),
    antiRepeatDirective(input.recentAssistantSnippets),
    "",
    INTENT_GUIDANCE[intent],
    "",
    input.operatorBrief ? `Host session:\n${input.operatorBrief}` : "",
    memoryLines.length ? `Memory:\n${memoryLines.join("\n")}` : "",
    market && input.watchlistBrief ? `Watchlist intel:\n${input.watchlistBrief}` : "",
    market && input.sentinelBrief ? `Sentinel notes:\n${input.sentinelBrief}` : "",
    "",
    input.liveMarketData
      ? `LIVE MARKET DATA (prefer this for rankings / what's moving / best today):\n${input.liveMarketData}`
      : "",
    input.liveTokenData
      ? `LIVE TOKEN INTELLIGENCE (source of truth for this token — LIVE vs UNAVAILABLE fields):\n${input.liveTokenData}`
      : "",
    input.liveLaunchData
      ? `LIVE LAUNCH WATCH (newest public launches and social posts about launching):\n${input.liveLaunchData}`
      : "",
    market ? `Live market brief:\n${input.marketBrief}` : "",
    market && input.moversBrief ? `\nRanked movers:\n${input.moversBrief}` : "",
    market && input.tokenIntel
      ? `\nClient pool snapshot (may be delayed; ignore holder % unless LIVE TOKEN INTELLIGENCE lists it as LIVE):\n${input.tokenIntel}`
      : "",
    market && input.research?.length
      ? `\nCURRENT RESEARCH DATA:\n${JSON.stringify(input.research, null, 2).slice(0, 8000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
