import type { WalletSnapshot } from "./solanaWallet";

/** Short, non-sensitive context for Hera. Never includes keys or auth tokens. */
export function buildConnectedWalletBrief(snapshot: WalletSnapshot | null, kind: string | null): string | null {
  if (!snapshot?.address) return null;
  const short = `${snapshot.address.slice(0, 4)}…${snapshot.address.slice(-4)}`;
  const top = snapshot.tokens.slice(0, 8).map((t) => {
    const amount = Number.isFinite(t.uiAmount) ? t.uiAmount.toPrecision(4) : "?";
    return `${amount} ${t.symbol || t.mint.slice(0, 4)}`;
  });
  const holdings = top.length ? top.join(", ") : "no SPL token balances above zero";
  return [
    `Connected external wallet (${kind || "Solana"}): ${short}.`,
    `SOL balance about ${snapshot.sol.toFixed(4)}.`,
    `Top holdings (read-only): ${holdings}.`,
    "Analysis is advisory only. Never claim a token is safe. Do not move funds or request signing.",
  ].join(" ");
}
