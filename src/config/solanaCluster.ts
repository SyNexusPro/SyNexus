/**
 * Solana cluster selection. An unset value stays on mainnet.
 * A testing build sets VITE_SOLANA_CLUSTER=devnet. An explicit RPC still wins.
 */
export function resolveSolanaCluster(
  cluster: string | undefined,
  explicitRpc?: string,
): { cluster: "devnet" | "mainnet-beta"; rpc: string } {
  const selected = cluster?.trim() === "devnet" ? "devnet" : "mainnet-beta";
  const explicit = explicitRpc?.trim() || "";
  if (explicit) return { cluster: selected, rpc: explicit };
  if (selected === "devnet") return { cluster: "devnet", rpc: "https://api.devnet.solana.com" };
  return { cluster: "mainnet-beta", rpc: "https://api.mainnet-beta.solana.com" };
}
