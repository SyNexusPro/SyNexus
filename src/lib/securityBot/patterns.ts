/** Attack / abuse / cheat patterns — defensive matching only. */

const INJECTION = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on(?:error|load|click|mouse\w+|focus|blur)\s*=/i,
  /data:text\/html/i,
  /\bunion\s+select\b/i,
  /\bdrop\s+table\b/i,
  /;\s*--/,
  /<\/?iframe/i,
  /<\/?object/i,
  /<\/?embed/i,
];

const PHISHING = [
  /\bseed\s*phrase\b/i,
  /\bprivate\s*key\b/i,
  /\bsecret\s*recovery\b/i,
  /\brecovery\s*phrase\b/i,
  /\b12\s*words?\b/i,
  /\b24\s*words?\b/i,
  /\bmnemonic\b/i,
  /\bexport\s*wallet\b/i,
  /\bverify\s*your\s*wallet\b/i,
  /\bconnect\s*wallet\s*to\s*claim\b/i,
  /\bairdrop\s*claim\s*now\b/i,
  /\bsend\s*sol\s*to\s*verify\b/i,
  /\bdrain(er)?\b/i,
  /\bapprove\s*all\b/i,
  /\bsign\s*to\s*claim\b/i,
  /\bwallet\s*connect\s*error\b/i,
];

const IMPERSONATION = [
  /\bsynexus\s*support\b/i,
  /\bofficial\s*synexus\b.*\bdm\b/i,
  /\btelegram\s*support\b.*\bseed\b/i,
  /\bwe\s*detected\s*unauthorized\b/i,
  /\baccount\s*will\s*be\s*suspended\b/i,
  /\bclick\s*here\s*to\s*avoid\s*ban\b/i,
  /\bverify\s*within\s*\d+\s*(hours|minutes)\b/i,
  /\bmeta\s*mask\s*support\b/i,
  /\bphantom\s*support\b/i,
];

const SUSPICIOUS_TLD = /\.(zip|exe|apk|scr|bat|cmd|msi|dll|vbs|ps1)(\?|$)/i;

const FAKE_SYNEXUS_HOST =
  /https?:\/\/(?:www\.)?(?:syn-?ex?us|synexuss|synexs|syneuxs|hive-?mind)[^.\s]*\.(?!pro\b)[a-z]{2,}/i;

const DRAINER_DOMAINS = /\b(?:t\.me\/\+|discord\.gg\/[a-z0-9-]{8,})\b/i;

const SOLANA_SCAM = [
  /\bset\s*authority\b/i,
  /\brevoke\s*authority\b/i,
  /\btransfer\s*all\s*(?:sol|tokens?)\b/i,
  /\bfake\s*(?:usdc|usdt|sol)\b/i,
  /\bunlimited\s*approve\b/i,
  /\bpermit\s*signature\b/i,
  /\bsign\s*to\s*(?:unlock|verify|claim)\b/i,
  /\bblur\s*(?:marketplace|listing)\b/i,
  /\bwallet\s*validation\s*required\b/i,
];

const BIP39_LEAK = /\b(?:abandon|ability|able|about|above)\b.*\b(?:zone|zoo|zodiac|youth)\b/i;

/** Solana mints are base58, 32–44 chars; symbols are short alphanumeric. */
export function isMalformedTokenQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.length > 64) return true;
  if (/[\x00-\x1f\x7f]/.test(q)) return true;
  if (/[<>"'`;{}\\]/.test(q)) return true;
  if (/\s{2,}/.test(q)) return true;
  return false;
}

export function matchThreatPatterns(text: string): {
  injection: boolean;
  phishing: boolean;
  impersonation: boolean;
  suspiciousLink: boolean;
} {
  const sample = String(text).slice(0, 8000);
  const phishing =
    PHISHING.some((re) => re.test(sample)) ||
    SOLANA_SCAM.some((re) => re.test(sample)) ||
    DRAINER_DOMAINS.test(sample) ||
    BIP39_LEAK.test(sample);
  return {
    injection: INJECTION.some((re) => re.test(sample)),
    phishing,
    impersonation: IMPERSONATION.some((re) => re.test(sample)),
    suspiciousLink: SUSPICIOUS_TLD.test(sample) || FAKE_SYNEXUS_HOST.test(sample),
  };
}

/** Basic auth hardening — not a full validator. */
export function isSuspiciousAuthEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return true;
  if (e.length > 254) return true;
  const disposable = /@(mailinator|tempmail|guerrillamail|10minutemail|yopmail)\./i;
  return disposable.test(e);
}

export function isSuspiciousAuthPassword(password: string): boolean {
  if (password.length > 256) return true;
  return INJECTION.some((re) => re.test(password));
}

export function isLikelyBotEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { webdriver?: boolean };
  if (nav.webdriver) return true;
  if (!nav.languages?.length) return true;
  return false;
}

export function sanitizeForLog(text: string, max = 240): string {
  return String(text).replace(/\s+/g, " ").trim().slice(0, max);
}
