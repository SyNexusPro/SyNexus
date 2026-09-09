/** In-session Hera focus token — follow-ups like "what about the liquidity?" keep the last mint. */

import type { Token } from "../../data/tokens";
import { SYN_MINT, SYN_SYMBOL } from "../../config/synToken";
import { resolveOracleTokenQuery } from "../oracleCryptoBrain";

export type HeraFocusToken = {
  symbol: string;
  name: string;
  mint: string;
};

let focus: HeraFocusToken | null = null;

const FOLLOW_UP =
  /\b(liquidity|volume|holders?|holder count|market ?cap|mcap|fdv|the price|price now|risk|the (token|coin|pair)|what about (it|that)|and (its |the )?(liq|liquidity|volume|holders?))\b/i;

export function getHeraFocusToken(): HeraFocusToken | null {
  return focus;
}

export function setHeraFocusToken(next: HeraFocusToken | null): void {
  focus = next;
}

export function rememberHeraFocus(token: Pick<Token, "symbol" | "name"> & { mintAddress?: string }): void {
  if (!token.mintAddress) {
    if (token.symbol.toUpperCase() === SYN_SYMBOL) {
      focus = { symbol: SYN_SYMBOL, name: token.name, mint: SYN_MINT };
    }
    return;
  }
  focus = { symbol: token.symbol, name: token.name, mint: token.mintAddress };
}

export function isTokenFollowUp(text: string): boolean {
  return FOLLOW_UP.test(text);
}

export function resolveHeraFocus(
  message: string,
  pool: Token[],
  history: { role: string; content?: string; text?: string }[] = [],
): Token | HeraFocusToken | null {
  const named = resolveOracleTokenQuery(message, pool);
  if (named) {
    rememberHeraFocus(named);
    return named;
  }

  if (isTokenFollowUp(message) && focus) {
    const fromPool =
      pool.find((t) => t.mintAddress === focus!.mint) ??
      pool.find((t) => t.symbol.toUpperCase() === focus!.symbol.toUpperCase());
    return fromPool ?? focus;
  }

  for (const turn of [...history].reverse()) {
    const text = (turn.content || turn.text || "").trim();
    if (!text) continue;
    const hit = resolveOracleTokenQuery(text, pool);
    if (hit) {
      rememberHeraFocus(hit);
      return hit;
    }
  }

  return focus;
}

export function focusMintOf(token: Token | HeraFocusToken | null): string | null {
  if (!token) return null;
  if ("mint" in token && token.mint) return token.mint;
  const mintAddress = "mintAddress" in token ? token.mintAddress : undefined;
  if (mintAddress) return mintAddress;
  return token.symbol.toUpperCase() === SYN_SYMBOL ? SYN_MINT : null;
}
