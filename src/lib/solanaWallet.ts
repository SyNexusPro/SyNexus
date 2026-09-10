import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { JUPITER_SOL_MINT } from "./solanaTradeLinks";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const SOL_FEE_RESERVE = 0.005;

export type SolanaWalletKind = "Phantom" | "Solflare" | "Solana";

export type SolanaWalletProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string } | null;
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction?: (tx: VersionedTransaction) => Promise<{ signature: string }>;
  signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type WalletTokenBalance = {
  mint: string;
  symbol: string;
  name: string;
  uiAmount: number;
  decimals: number;
  raw: string;
};

export type WalletSnapshot = {
  address: string;
  kind: SolanaWalletKind;
  sol: number;
  tokens: WalletTokenBalance[];
};

function asProvider(value: unknown): SolanaWalletProvider | null {
  if (!value || typeof value !== "object") return null;
  const p = value as SolanaWalletProvider;
  return typeof p.connect === "function" ? p : null;
}

export function detectSolanaProviders(): { kind: SolanaWalletKind; provider: SolanaWalletProvider }[] {
  if (typeof window === "undefined") return [];
  const found: { kind: SolanaWalletKind; provider: SolanaWalletProvider }[] = [];
  const phantom = asProvider(window.phantom?.solana) ?? (window.solana?.isPhantom ? asProvider(window.solana) : null);
  const solflare = asProvider(window.solflare);
  const generic = asProvider(window.solana);

  if (phantom) found.push({ kind: "Phantom", provider: phantom });
  if (solflare && solflare !== phantom) found.push({ kind: "Solflare", provider: solflare });
  if (generic && generic !== phantom && generic !== solflare) {
    found.push({ kind: generic.isSolflare ? "Solflare" : "Solana", provider: generic });
  }
  return found;
}

export function hasInjectedSolanaWallet(): boolean {
  return detectSolanaProviders().length > 0;
}

export function phantomBrowseUrl(href = typeof window !== "undefined" ? window.location.href : ""): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.origin : "https://synexus.pro",
  )}`;
}

export function shortenAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 3) return address;
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}

export function getSolanaRpcUrl(): string {
  const fromEnv = (import.meta.env.VITE_SOLANA_RPC_URL ?? "").trim();
  return fromEnv || "https://api.mainnet-beta.solana.com";
}

export function getSolanaConnection(): Connection {
  return new Connection(getSolanaRpcUrl(), "confirmed");
}

export async function connectSolanaWallet(kind?: SolanaWalletKind): Promise<{
  address: string;
  kind: SolanaWalletKind;
  provider: SolanaWalletProvider;
}> {
  const providers = detectSolanaProviders();
  if (!providers.length) {
    throw new Error("No Solana wallet found. Open this page in Phantom or Solflare.");
  }
  const match = kind ? providers.find((p) => p.kind === kind) : providers[0];
  const picked = match ?? providers[0];
  const result = await picked.provider.connect();
  const address = result.publicKey?.toString() ?? picked.provider.publicKey?.toString();
  if (!address) throw new Error("Wallet did not return a public key.");
  return { address, kind: picked.kind, provider: picked.provider };
}

export async function tryReconnectSolanaWallet(): Promise<{
  address: string;
  kind: SolanaWalletKind;
  provider: SolanaWalletProvider;
} | null> {
  const providers = detectSolanaProviders();
  for (const picked of providers) {
    try {
      const result = await picked.provider.connect({ onlyIfTrusted: true });
      const address = result.publicKey?.toString() ?? picked.provider.publicKey?.toString();
      if (address) return { address, kind: picked.kind, provider: picked.provider };
    } catch {
      /* not trusted yet */
    }
  }
  return null;
}

type ParsedTokenAmount = {
  amount?: string;
  decimals?: number;
  uiAmount?: number | null;
};

async function readProgramBalances(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<WalletTokenBalance[]> {
  const resp = await connection.getParsedTokenAccountsByOwner(owner, { programId });
  const out: WalletTokenBalance[] = [];
  for (const { account } of resp.value) {
    const info = account.data.parsed?.info as
      | { mint?: string; tokenAmount?: ParsedTokenAmount }
      | undefined;
    const mint = info?.mint;
    const amt = info?.tokenAmount;
    const ui = amt?.uiAmount ?? 0;
    if (!mint || !Number.isFinite(ui) || ui <= 0) continue;
    out.push({
      mint,
      symbol: mint.slice(0, 4).toUpperCase(),
      name: mint,
      uiAmount: ui,
      decimals: amt?.decimals ?? 0,
      raw: amt?.amount ?? "0",
    });
  }
  return out;
}

export async function fetchWalletSnapshot(address: string, kind: SolanaWalletKind): Promise<WalletSnapshot> {
  const connection = getSolanaConnection();
  const owner = new PublicKey(address);
  const [lamports, spl, token2022] = await Promise.all([
    connection.getBalance(owner),
    readProgramBalances(connection, owner, TOKEN_PROGRAM_ID),
    readProgramBalances(connection, owner, TOKEN_2022_PROGRAM_ID),
  ]);
  const tokens = [...spl, ...token2022]
    .filter((t) => t.mint !== JUPITER_SOL_MINT)
    .sort((a, b) => b.uiAmount - a.uiAmount);

  return {
    address,
    kind,
    sol: lamports / 1_000_000_000,
    tokens,
  };
}

export function maxSpendable(mint: string, snapshot: WalletSnapshot | null): number {
  if (!snapshot) return 0;
  if (mint === JUPITER_SOL_MINT) return Math.max(0, snapshot.sol - SOL_FEE_RESERVE);
  const row = snapshot.tokens.find((t) => t.mint === mint);
  return row?.uiAmount ?? 0;
}

export function toAtomicAmount(uiAmount: number, decimals: number): bigint {
  if (!Number.isFinite(uiAmount) || uiAmount <= 0) return 0n;
  const factor = 10 ** decimals;
  return BigInt(Math.floor(uiAmount * factor));
}

export function fromAtomicAmount(raw: string | number | bigint, decimals: number): number {
  const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** decimals;
}

export function decodeBase64Bytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function walletSignAndSend(
  provider: SolanaWalletProvider,
  swapTransactionB64: string,
): Promise<string> {
  const tx = VersionedTransaction.deserialize(decodeBase64Bytes(swapTransactionB64));
  if (provider.signAndSendTransaction) {
    const sent = await provider.signAndSendTransaction(tx);
    if (!sent?.signature) throw new Error("Wallet did not return a signature.");
    return sent.signature;
  }
  if (!provider.signTransaction) {
    throw new Error("This wallet cannot sign Solana transactions.");
  }
  const signed = await provider.signTransaction(tx);
  const sig = await getSolanaConnection().sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  return sig;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
    phantom?: { solana?: SolanaWalletProvider };
    solflare?: SolanaWalletProvider;
  }
}
