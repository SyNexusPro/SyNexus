/**
 * Sentinel Helix — wallet & key-security lane (SyN Wallet when it ships).
 * Protects keys, signing hygiene, phishing, and vault posture (not token rugs — that's Aegis).
 */

export const HELIX_SENTINEL_NAME = "Sentinel Helix";
export const HELIX_SHORT_NAME = "Helix";
export const HELIX_ROLE = "Wallet & key security";

export const HELIX_ROLE_DETAIL =
  "Key vault integrity · unlock hygiene · scan-before-sign · phishing blocks · signature simulation gates";

export const HELIX_STATUS_IDLE =
  "Helix standing watch — when SyN Wallet ships, keys stay on-device and no seed leaves your vault.";

export const HELIX_LESSON =
  "Every locked session, verified address, and scan-before-sign makes Helix sharper before the next signature.";

export const HELIX_SECURITY_POINTS = [
  "Recovery phrases encrypt into device secure storage (Keystore / Keychain on native).",
  "PIN unlock required before send or swap — Helix never stores plaintext seeds in the cloud.",
  "Scan-before-sign: run Sentinel reads on a mint before you approve a transfer or Jupiter route.",
  "Blocks seed-phrase phishing in chat — SyNexus support will never ask for your 12/24 words.",
  "Prefer the mobile app for production keys; browser vaults are encrypted but less hardened.",
  "Simulate swaps locally when available; reject transactions that don't list your wallet as signer.",
] as const;

export function buildHelixBrief(): string {
  return [
    `${HELIX_SENTINEL_NAME} — ${HELIX_ROLE}`,
    "",
    "Mission: best security for self-custody wallets — encryption, unlock hygiene, phishing defense, and scan-before-sign.",
    "Aegis owns token rugs; Helix owns your keys and every signature.",
    "",
    "SyN Wallet is on hold in future/syn-wallet/ — Helix is already on the Sentinel grid.",
  ].join("\n");
}

export function answerHelixQuestion(question: string): string | null {
  const q = question.toLowerCase().trim();

  if (/helix|sentinel helix|wallet (security|guard|protect)|key vault|syn wallet/.test(q)) {
    if (/who|what|do you|mission|role|name/.test(q) || /^helix\b/.test(q) || /sentinel helix/.test(q)) {
      return buildHelixBrief();
    }
  }

  if (/seed phrase|recovery phrase|12 words|24 words|private key/.test(q) && /wallet|syn|vault|helix|share|give|ask/.test(q)) {
    return `${HELIX_SHORT_NAME}: Never paste your recovery phrase into chat, email, or a “support” link. We will never ask for it — and we cannot recover a lost seed.`;
  }

  if (/pin|password|unlock|biometric|face id|fingerprint/.test(q) && /wallet|syn|helix/.test(q)) {
    return `${HELIX_SHORT_NAME}: Use a strong PIN, enable biometrics on the app when available, and lock your wallet when you leave the screen. Unlock only when you are about to send or swap.`;
  }

  if (/scan.?before.?sign|before (i )?(send|swap|sign)|signing/.test(q)) {
    return `${HELIX_SHORT_NAME}: Scan the mint on the home feed first — Aegis reads rugs, Helix clears the signature path. Never sign a blind Jupiter or send tx you did not review.`;
  }

  if (/phish|fake (wallet|app)|clipboard|address poison/.test(q)) {
    return `${HELIX_SHORT_NAME}: Verify the full Solana address before send. Clipboard malware swaps last characters — check the first and last 4+ chars against a trusted source.`;
  }

  if (/^helix\b|sentinel helix/.test(q)) {
    return buildHelixBrief();
  }

  return null;
}
