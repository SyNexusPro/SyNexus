/** Hera may read. She may not move funds, trade, or change an account. */

export const HERA_READ_TOOLS = [
  "resolve_token",
  "rate_risk",
  "provider_status",
  "social_summary",
  "forming_coins",
] as const;

export type HeraReadTool = (typeof HERA_READ_TOOLS)[number];

const MUTATION =
  /\b(transfer|withdraw|send sol|swap|execute trade|place order|admin|grant role|delete account|change password|drain|sign transaction)\b/i;

export function heraToolAllowed(name: string): name is HeraReadTool {
  return (HERA_READ_TOOLS as readonly string[]).includes(name);
}

export function heraRequestIsMutation(text: string): boolean {
  return MUTATION.test(text);
}
