/** Server-side Titan input hardening (do not trust client SecurityBot alone). */

const BLOCK = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /\bunion\s+select\b/i,
  /\bdrop\s+table\b/i,
  /;\s*--/,
  /\bseed\s*phrase\b/i,
  /\bprivate\s*key\b/i,
  /\bignore (all |previous |above )?instructions\b/i,
  /\byou are now\b.*\b(dan|jailbreak|unrestricted)\b/i,
  /\bsystem\s*prompt\b.*\b(reveal|show|print)\b/i,
  /\boverride\s+(your|the)\s+(rules|guardrails|safety)\b/i,
];

export function guardTitanServerMessage(message: string): { ok: true } | { ok: false; reason: string } {
  const text = message.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > 4000) return { ok: false, reason: "too_long" };
  for (const re of BLOCK) {
    if (re.test(text)) {
      return { ok: false, reason: "blocked_content" };
    }
  }
  return { ok: true };
}
