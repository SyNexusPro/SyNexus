import { TITAN_COACH_REDIRECTS, TITAN_GUARDRAILS } from "../config/titanGuidelines";

/** Patterns where we used to append a disclaimer — kept for optional future use. */
const HEAVY_FINANCIAL_CLAIM_PATTERNS = [
  /\bguaranteed profit\b/i,
  /\bcan't lose\b/i,
  /\b100x guaranteed\b/i,
];

export function isFinancialAdviceRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return /\b(should i (buy|sell|ape|enter|long|short)|what (coin|token) should i buy|tell me what to buy)\b/i.test(
    lower,
  );
}

/** Shia speaks freely — only trim egregious guaranteed-profit language, no disclaimer spam. */
export function softenTitanResponse(text: string): string {
  if (!HEAVY_FINANCIAL_CLAIM_PATTERNS.some((pattern) => pattern.test(text))) {
    return text;
  }
  return text
    .replace(/\bguaranteed profit\b/gi, "upside potential")
    .replace(/\bcan't lose\b/gi, "still has risk")
    .replace(/\b100x guaranteed\b/gi, "high-upside speculation");
}

export function buildTitanCoachRedirect(operatorName: string, seed = 0): string {
  const name = operatorName && operatorName !== "there" ? operatorName : "operator";
  const line = TITAN_COACH_REDIRECTS[Math.abs(seed) % TITAN_COACH_REDIRECTS.length]!;
  return `${line} What token should I scan for you, ${name}?`;
}

export function appendTitanDecisionFooter(intel: string): string {
  return `${intel.trim()}\n\nThat's my read — you decide. ${TITAN_GUARDRAILS.disclaimer}`;
}
