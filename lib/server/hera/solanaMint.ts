import bs58 from "bs58";

const MINT_TEXT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Accept a Solana address only when it is base58 and decodes to 32 bytes. */
export function parseSolanaMint(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const mint = value.trim();
  if (!MINT_TEXT.test(mint)) return null;
  try {
    if (bs58.decode(mint).length !== 32) return null;
  } catch {
    return null;
  }
  return mint;
}
