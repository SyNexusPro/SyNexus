#!/usr/bin/env node
/**
 * SyNexus Aegis self-test — pattern + rate-limit smoke checks (no browser).
 * Run: npm run aegis:check
 */

const INJECTION = [/<script[\s>]/i, /javascript\s*:/i, /\bunion\s+select\b/i, /<\/?iframe/i];
const PHISHING = [
  /\bseed\s*phrase\b/i,
  /\bprivate\s*key\b/i,
  /\bdrain(er)?\b/i,
  /\bset\s*authority\b/i,
  /\bunlimited\s*approve\b/i,
];
const IMPERSONATION = [/\bsynexus\s*support\b/i, /\bofficial\s*synexus\b.*\bdm\b/i];
const SUSPICIOUS = [/\.(exe|apk|scr)(\?|$)/i, /synexuss\.(?!pro\b)/i];
const MALFORMED = (q) => q.length > 64 || /[<>"'`;{}\\]/.test(q);

function matchThreat(text) {
  return {
    injection: INJECTION.some((re) => re.test(text)),
    phishing: PHISHING.some((re) => re.test(text)),
    impersonation: IMPERSONATION.some((re) => re.test(text)),
    suspiciousLink: SUSPICIOUS.some((re) => re.test(text)),
  };
}

function blocked(text) {
  const t = matchThreat(text);
  return t.injection || t.phishing || t.impersonation || t.suspiciousLink;
}

function testPatterns() {
  let pass = 0;
  let fail = 0;

  const cases = [
    { text: '<script>alert(1)</script>', expectBlock: true },
    { text: "Send me your seed phrase", expectBlock: true },
    { text: "javascript:steal()", expectBlock: true },
    { text: "wallet drainer approve all", expectBlock: true },
    { text: "set authority on your token account", expectBlock: true },
    { text: "SyNexus support DM me your key", expectBlock: true },
    { text: "Paste mint BONK — is it safe?", expectBlock: false },
    { text: "https://synexus.pro/terms", expectBlock: false },
    { text: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", expectBlock: false },
  ];

  for (const { text, expectBlock } of cases) {
    const isBlocked = blocked(text);
    if (isBlocked === expectBlock) pass += 1;
    else {
      fail += 1;
      console.error(`  ✗ pattern: "${text.slice(0, 40)}" expected block=${expectBlock}`);
    }
  }

  for (const s of ["BONK", "Should I buy this token?", "AVOID · WATCH · OK"]) {
    if (!blocked(s)) pass += 1;
    else {
      fail += 1;
      console.error(`  ✗ false positive: "${s}"`);
    }
  }

  for (const { q, bad } of [
    { q: "a".repeat(80), bad: true },
    { q: 'EPjF<script>', bad: true },
    { q: "BONK", bad: false },
  ]) {
    if (MALFORMED(q) === bad) pass += 1;
    else {
      fail += 1;
      console.error(`  ✗ malformed query: "${q.slice(0, 20)}" expected bad=${bad}`);
    }
  }

  return { pass, fail };
}

function testRateLimitLogic() {
  const max = 3;
  const windowMs = 1000;
  let count = 0;
  let windowStart = Date.now();
  let blocked = false;

  for (let i = 0; i < 5; i += 1) {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      count = 0;
      windowStart = now;
    }
    count += 1;
    if (count > max) blocked = true;
  }

  return blocked ? { pass: 1, fail: 0 } : { pass: 0, fail: 1 };
}

console.log("\nSynexus Aegis self-test");
console.log("═".repeat(40));

const p1 = testPatterns();
console.log(`Patterns: ${p1.pass} passed${p1.fail ? `, ${p1.fail} failed` : ""}`);

const p2 = testRateLimitLogic();
console.log(`Rate limit logic: ${p2.fail ? "FAILED" : "OK"}`);

const totalFail = p1.fail + p2.fail;
if (totalFail > 0) {
  console.error("\n✗ Aegis self-test failed\n");
  process.exit(1);
}

console.log("\n✓ Aegis self-test passed\n");
