import type { Token } from "../data/tokens";
import { matchThreatPatterns } from "./securityBot/patterns";

/**
 * Helix watches signing/phishing traps in token identity — not rug heuristics (Aegis).
 * Name/ticker bait like "CLAIM NOW" or seed-phrase language is a Helix hit.
 */
const NAME_TRAP =
  /\b(?:airdrop|drainer|mnemonic|seed\s*phrase|claim\s*now|connect\s*wallet|free\s*nft|wallet\s*verify|validate\s*wallet)\b/i;

export function helixIdentityBlob(token: Pick<Token, "symbol" | "name">): string {
  return `${token.symbol} ${token.name}`;
}

export function helixThreatScore(token: Pick<Token, "symbol" | "name">): number {
  const identity = helixIdentityBlob(token);
  const threats = matchThreatPatterns(identity);
  let score = 0;
  if (threats.phishing || threats.impersonation) score += 2;
  if (threats.suspiciousLink || threats.injection) score += 2;
  if (NAME_TRAP.test(identity)) score += 1;
  return score;
}

export function tokenLooksLikeSigningTrap(token: Pick<Token, "symbol" | "name">): boolean {
  return helixThreatScore(token) >= 1;
}

export function collectHelixHits<T extends Pick<Token, "symbol" | "name">>(tokens: T[]): T[] {
  return tokens
    .filter((t) => tokenLooksLikeSigningTrap(t))
    .sort((a, b) => helixThreatScore(b) - helixThreatScore(a));
}
