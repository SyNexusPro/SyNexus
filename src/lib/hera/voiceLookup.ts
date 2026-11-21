/**
 * Which existing voice tool a live delegation should run.
 * A greeting or an ordinary question returns null so no specialist is called.
 */

export type VoiceLookup =
  | { tool: "venue_desk"; arguments: Record<string, never> }
  | { tool: "memory_search"; arguments: { query: string } }
  | { tool: "alexus_learning"; arguments: Record<string, never> }
  | { tool: "route_compare"; arguments: { mint: string } };

export function voiceLookupForTranscript(text: string): VoiceLookup | null {
  const said = text.replace(/\s+/g, " ").trim();
  if (said.length < 3) return null;
  const lower = said.toLowerCase();
  const mint = said.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)?.[0];
  if (/\b(jupiter|round-?trip|fee schedule|gmgn)\b/.test(lower) && mint) {
    return { tool: "route_compare", arguments: { mint } };
  }
  if (/\b(alexus|paper lessons?|paper trading|trade lessons?|trading lessons?)\b/.test(lower)) {
    return { tool: "alexus_learning", arguments: {} };
  }
  if (
    /\b(remember|you told me|research note|last time we|youtube|video|headline|news about|what (?:have you|did you) learn|trading (?:tip|advice|setup)|learn(?:ed|ing)? about)\b/.test(
      lower,
    )
  ) {
    return { tool: "memory_search", arguments: { query: said.slice(0, 240) } };
  }
  if (/\b(price|priced|trading at|last price|venues?|ticker|how much is|market (?:for|on)|what's going on with)\b/.test(lower)) {
    return { tool: "venue_desk", arguments: {} };
  }
  if (/\b(coin|token|solana|crypto|chart|liquidity|volume|mcap|holders?)\b/.test(lower) && said.length >= 12) {
    return { tool: "memory_search", arguments: { query: said.slice(0, 240) } };
  }
  return null;
}
