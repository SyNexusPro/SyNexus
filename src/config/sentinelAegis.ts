/**
 * Sentinel Aegis — the Security & Privacy lane.
 * Token scams/rugs (on-chain) + operator privacy, account safety, and app security (off-chain).
 */

export const AEGIS_SENTINEL_NAME = "Sentinel Aegis";

export const AEGIS_SHORT_NAME = "Aegis";

export const AEGIS_ROLE = "Security & privacy";

export const AEGIS_ROLE_DETAIL =
  "Scam and rug detection · contract & liquidity integrity · privacy-safe operator accounts · phishing awareness";

export const AEGIS_STATUS_IDLE =
  "Standing by — Aegis guards tokens, your operator account, and privacy posture.";

export const AEGIS_LESSON =
  "Every scam report you confirm and every privacy setting you tighten makes Aegis sharper on the next threat.";

export const AEGIS_PRIVACY_POINTS = [
  "Non-custodial — SyNexus never holds your SOL, tokens, or seed phrases.",
  "Wallet keys stay in Phantom, Solflare, or your hardware wallet — not on our servers.",
  "Operator Link uses verified email sign-in; we don't ask for seed phrases or private keys.",
  "Titan personalized memory and feedback are opt-in only — off by default.",
  "Full retention and rights are in the Privacy Policy on /privacy.",
] as const;

export const AEGIS_SECURITY_POINTS = [
  "Contract authority, liquidity depth, and wallet concentration on every scanned token.",
  "Rug-pull heuristics, honeypot patterns, and community abuse reports fused into risk bands.",
  "In-app SecurityBot blocks suspicious chat patterns and validates Pro grant sources.",
  "Verify mint addresses and URLs — SyNexus support will never DM you for a seed phrase.",
] as const;

export function buildAegisSecurityPrivacyBrief(): string {
  return [
    `${AEGIS_SENTINEL_NAME} — ${AEGIS_ROLE}`,
    "",
    "On-chain: scams, rugs, suspicious contracts, thin liquidity, wallet concentration.",
    "Off-chain: privacy-safe accounts, no custody, opt-in memory, verified sign-in.",
    "",
    "Ask Titan to scan a token, or visit Trust for the full security & privacy breakdown.",
  ].join("\n");
}

export function answerAegisSecurityPrivacyQuestion(question: string): string | null {
  const q = question.toLowerCase().trim();

  if (/privacy|personal data|my data|what (data|info) do you|gdpr|delete my data/.test(q)) {
    return [
      `${AEGIS_SHORT_NAME} (security & privacy): SyNexus does not sell your personal information.`,
      "We use email and profile data to run Operator Link and Pro — not to move your crypto.",
      "Titan memory and feedback stay opt-in. Device storage may hold chat history locally.",
      "Read /privacy for retention, cookies, and your rights.",
    ].join(" ");
  }

  if (/seed phrase|private key|recovery phrase|12 words|24 words/.test(q)) {
    return `${AEGIS_SHORT_NAME}: Never share your seed phrase — with SyNexus, Titan, or anyone in DMs. We will never ask for it. That's a phishing scam, not support.`;
  }

  if (/phish|fake support|scam dm|telegram scam|discord scam/.test(q)) {
    return `${AEGIS_SHORT_NAME}: Real SyNexus support won't ask for keys or "verify" your wallet in a link. Use /contact and /trust only — paste suspicious mints here for a rug read first.`;
  }

  if (/non-?custodial|hold my (crypto|funds|sol)|custody/.test(q)) {
    return `${AEGIS_SHORT_NAME}: SyNexus is non-custodial intelligence. You sign every swap in your wallet app — we route reads and Jupiter shortcuts, not your keys.`;
  }

  if (/security|safe|trust|hack|compromised/.test(q) && /account|app|synexus|operator/.test(q)) {
    return [
      `${AEGIS_SHORT_NAME} guards operator security: verified email sign-in, no seed storage, SecurityBot on chat abuse,`,
      "and Sentinel scans before you connect a wallet. Pair that with a hardware wallet for size.",
    ].join(" ");
  }

  if (/^aegis|sentinel aegis|security sentinel|privacy sentinel/.test(q)) {
    return buildAegisSecurityPrivacyBrief();
  }

  return null;
}
