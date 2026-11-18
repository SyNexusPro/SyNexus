/**
 * Simple questions stay on the fast model. Harder questions earn a deeper one.
 * This is a local check. It does not call an API.
 */

const DEEP_INTENT = new Set(["strategy", "explain", "life_counsel"]);

const DEEP_WORDS =
  /\b(why|how come|debug|diagnose|architect|architecture|trade-?off|step by step|root cause|what(?:'| i)?s wrong|doesn'?t work|not working|should i|compare the (?:options|approaches)|walk me through)\b/i;

export function needsDeeperReasoning(message: string, intent?: string | null): boolean {
  const text = message.replace(/\s+/g, " ").trim();
  if (text.length < 12) return false;
  if (intent === "token_lookup" || intent === "market_movers" || intent === "launch_watch") return false;
  if (intent && DEEP_INTENT.has(intent)) return true;
  if (DEEP_WORDS.test(text)) return true;
  if ((text.match(/\?/g) ?? []).length >= 2) return true;
  return text.length > 320;
}
