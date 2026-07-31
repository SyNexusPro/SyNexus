export type MoverTimeframe = "5m" | "24h" | "7d" | "30d" | "365d";

export const MOVER_TIMEFRAMES: readonly MoverTimeframe[] = ["5m", "24h", "7d", "30d", "365d"] as const;

export const MOVER_TIMEFRAME_LABEL: Record<MoverTimeframe, string> = {
  "5m": "last 5 minutes",
  "24h": "last 24 hours",
  "7d": "last 7 days (week)",
  "30d": "last 30 days (month)",
  "365d": "last 365 days (year)",
};

/** Parse user phrasing → timeframe (default 24h for generic "top gainers"). */
export function parseMoverTimeframeFromText(text: string): MoverTimeframe {
  const lower = text.toLowerCase();
  if (/\b(5\s*m(in(ute)?s?)?|five\s*min)\b/.test(lower)) return "5m";
  if (/\b(365|year|yearly|12\s*month|past\s*year|last\s*year|ytd)\b/.test(lower)) return "365d";
  if (/\b(30\s*d(ay)?s?|month|monthly|past\s*month|last\s*month)\b/.test(lower)) return "30d";
  if (/\b(7\s*d(ay)?s?|week|weekly|past\s*week|last\s*week)\b/.test(lower)) return "7d";
  if (/\b(24\s*h(our)?s?|today|day|daily|past\s*day|last\s*day)\b/.test(lower)) return "24h";
  return "24h";
}

export function isTopMoversQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    /\b(top|best|biggest|leading|highest)\b/.test(lower) &&
    /\b(gainer|gainers|loser|losers|mover|movers|pump|pumping|rally|rallying|winner|winners)\b/.test(lower)
  ) || /\bwhat('?s| is) (pumping|moving|hot)\b/.test(lower);
}
