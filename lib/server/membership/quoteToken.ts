import { createHmac, timingSafeEqual } from "node:crypto";
import { ownerSigningKey } from "../ownerGrant.js";

export function signTradeQuote(payload: string, env: Record<string, string | undefined>): string | null {
  const key = ownerSigningKey(env);
  if (!key) return null;
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function tradeQuoteMatches(payload: string, token: string, env: Record<string, string | undefined>): boolean {
  const expected = signTradeQuote(payload, env);
  if (!expected || !token) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(token);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
