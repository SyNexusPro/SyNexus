import { TITAN_COACH_REDIRECTS, TITAN_GUARDRAILS } from "../config/titanGuidelines";

const BUY_NOW_PATTERNS = [
  /\b(buy|ape|long|short)\s+(now|it|this|today)\b/i,
  /\bshould i (buy|ape|enter|long)\b/i,
  /\b(guaranteed|guarantee|100x|10x|sure thing|can't lose)\b/i,
  /\bwhat (coin|token) should i buy\b/i,
  /\btell me what to buy\b/i,
  /\bgive me (a )?(pick|signal|call)\b/i,
];

const SOFTEN_RESPONSE_PATTERNS = [
  /\byou should buy\b/i,
  /\bbuy now\b/i,
  /\bguaranteed profit\b/i,
  /\bcan't lose\b/i,
  /\bape (it|this|now)\b/i,
];

export function isFinancialAdviceRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return BUY_NOW_PATTERNS.some((pattern) => pattern.test(lower));
}

export function softenTitanResponse(text: string): string {
  if (!SOFTEN_RESPONSE_PATTERNS.some((pattern) => pattern.test(text))) {
    return text;
  }
  return `${text.trim()}\n\n${TITAN_GUARDRAILS.disclaimer}`;
}

export function buildTitanCoachRedirect(operatorName: string, seed = 0): string {
  const name = operatorName && operatorName !== "there" ? operatorName : "operator";
  const line = TITAN_COACH_REDIRECTS[Math.abs(seed) % TITAN_COACH_REDIRECTS.length]!;
  return `${line} What token should I scan for you, ${name}?`;
}

export function appendTitanDecisionFooter(intel: string): string {
  return `${intel.trim()}\n\nThat's the read — you decide. ${TITAN_GUARDRAILS.disclaimer}`;
}
