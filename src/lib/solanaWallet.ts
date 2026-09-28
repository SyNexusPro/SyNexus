import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { JUPITER_SOL_MINT } from "./solanaTradeLinks";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const SOL_FEE_RESERVE = 0.005;

/** Wallet display name, e.g. "Phantom", "Backpack", "Solflare". */
export type SolanaWalletKind = string;

export type DetectedSolanaWallet = {
  kind: SolanaWalletKind;
  icon?: string;
  provider: SolanaWalletProvider;
};

const SOLANA_MAINNET_CHAIN = "solana:mainnet";
const LAST_WALLET_KEY = "synexus-last-solana-wallet";

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

type StandardAccount = { address: string; publicKey?: Uint8Array; chains?: readonly string[] };

type StandardWallet = {
  name: string;
  icon?: string;
  chains: readonly string[];
  accounts: readonly StandardAccount[];
  features: Record<string, unknown>;
};

type StandardConnectFeature = {
  connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly StandardAccount[] }>;
};
type StandardDisconnectFeature = { disconnect: () => Promise<void> };
type StandardEventsFeature = {
  on: (event: "change", listener: (props: { accounts?: readonly StandardAccount[] }) => void) => () => void;
};
type SolanaSignAndSendFeature = {
  signAndSendTransaction: (
    ...inputs: { account: StandardAccount; transaction: Uint8Array; chain: string }[]
  ) => Promise<readonly { signature: Uint8Array }[]>;
};
type SolanaSignFeature = {
  signTransaction: (
    ...inputs: { account: StandardAccount; transaction: Uint8Array; chain?: string }[]
  ) => Promise<readonly { signedTransaction: Uint8Array }[]>;
};

const standardWallets = new Set<StandardWallet>();
const standardAdapters = new WeakMap<StandardWallet, SolanaWalletProvider>();
const walletListeners = new Set<() => void>();
let standardDiscoveryStarted = false;

function isSolanaStandardWallet(wallet: StandardWallet): boolean {
  const features = wallet.features ?? {};
  return (
    Array.isArray(wallet.chains) &&
    wallet.chains.some((chain) => chain.startsWith("solana:")) &&
    "standard:connect" in features &&
    ("solana:signAndSendTransaction" in features || "solana:signTransaction" in features)
  );
}

function registerStandardWallets(...wallets: StandardWallet[]): () => void {
  let changed = false;
  for (const wallet of wallets) {
    if (wallet && isSolanaStandardWallet(wallet) && !standardWallets.has(wallet)) {
      standardWallets.add(wallet);
      changed = true;
    }
  }
  if (changed) walletListeners.forEach((listener) => listener());
  return () => {
    wallets.forEach((wallet) => standardWallets.delete(wallet));
    walletListeners.forEach((listener) => listener());
  };
}

/** Wallet Standard discovery — any compliant wallet (Backpack, Solflare, Phantom, OKX, Coinbase, …) registers itself. */
function startStandardDiscovery(): void {
  if (standardDiscoveryStarted || typeof window === "undefined") return;
  standardDiscoveryStarted = true;
  const api = Object.freeze({ register: registerStandardWallets });
  window.addEventListener("wallet-standard:register-wallet", (event) => {
    const callback = (event as CustomEvent<(api: { register: typeof registerStandardWallets }) => void>).detail;
    try {
      callback?.(api);
    } catch {
      /* misbehaving wallet */
    }
  });
  try {
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  } catch {
    /* old browsers */
  }
}

export function subscribeSolanaWallets(listener: () => void): () => void {
  startStandardDiscovery();
  walletListeners.add(listener);
  return () => {
    walletListeners.delete(listener);
  };
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += BASE58_ALPHABET[digits[i]];
  return out;
}

function standardChain(account: StandardAccount | null, wallet: StandardWallet): string {
  const chains = account?.chains?.length ? account.chains : wallet.chains;
  return chains.includes(SOLANA_MAINNET_CHAIN) ? SOLANA_MAINNET_CHAIN : chains.find((c) => c.startsWith("solana:")) ?? SOLANA_MAINNET_CHAIN;
}

function adaptStandardWallet(wallet: StandardWallet): SolanaWalletProvider {
  const cached = standardAdapters.get(wallet);
  if (cached) return cached;

  let account: StandardAccount | null = wallet.accounts[0] ?? null;
  const features = wallet.features;
  const connectFeature = features["standard:connect"] as StandardConnectFeature;
  const disconnectFeature = features["standard:disconnect"] as StandardDisconnectFeature | undefined;
  const eventsFeature = features["standard:events"] as StandardEventsFeature | undefined;
  const signAndSend = features["solana:signAndSendTransaction"] as SolanaSignAndSendFeature | undefined;
  const signOnly = features["solana:signTransaction"] as SolanaSignFeature | undefined;

  eventsFeature?.on("change", ({ accounts }) => {
    if (accounts) account = accounts[0] ?? null;
  });

  const requireAccount = (): StandardAccount => {
    if (!account) throw new Error(`${wallet.name} is not connected.`);
    return account;
  };

  const provider: SolanaWalletProvider = {
    get publicKey() {
      return account ? { toString: () => account!.address } : null;
    },
    get isConnected() {
      return Boolean(account);
    },
    connect: async (opts) => {
      const { accounts } = await connectFeature.connect({ silent: Boolean(opts?.onlyIfTrusted) });
      account = accounts[0] ?? wallet.accounts[0] ?? null;
      if (!account) throw new Error(`${wallet.name} did not share an account.`);
      const address = account.address;
      return { publicKey: { toString: () => address } };
    },
    disconnect: disconnectFeature
      ? async () => {
          await disconnectFeature.disconnect();
          account = null;
        }
      : async () => {
          account = null;
        },
    signAndSendTransaction: signAndSend
      ? async (tx) => {
          const acct = requireAccount();
          const [result] = await signAndSend.signAndSendTransaction({
            account: acct,
            transaction: tx.serialize(),
            chain: standardChain(acct, wallet),
          });
          if (!result?.signature) throw new Error("Wallet did not return a signature.");
          return { signature: encodeBase58(result.signature) };
        }
      : undefined,
    signTransaction: signOnly
      ? async (tx) => {
          const acct = requireAccount();
          const [result] = await signOnly.signTransaction({
            account: acct,
            transaction: tx.serialize(),
            chain: standardChain(acct, wallet),
          });
          if (!result?.signedTransaction) throw new Error("Wallet did not return a signed transaction.");
          return VersionedTransaction.deserialize(result.signedTransaction);
        }
      : undefined,
  };
  standardAdapters.set(wallet, provider);
  return provider;
}

function normalizeWalletName(name: string): string {
  return name.trim().toLowerCase();
}

function detectLegacyProviders(): DetectedSolanaWallet[] {
  if (typeof window === "undefined") return [];
  const found: DetectedSolanaWallet[] = [];
  const phantom = asProvider(window.phantom?.solana) ?? (window.solana?.isPhantom ? asProvider(window.solana) : null);
  const solflare = asProvider(window.solflare);
  const backpack = asProvider(window.backpack?.solana ?? window.backpack);
  const generic = asProvider(window.solana);

  if (phantom) found.push({ kind: "Phantom", provider: phantom });
  if (solflare && solflare !== phantom) found.push({ kind: "Solflare", provider: solflare });
  if (backpack && backpack !== phantom && backpack !== solflare) found.push({ kind: "Backpack", provider: backpack });
  if (generic && generic !== phantom && generic !== solflare && generic !== backpack) {
    found.push({ kind: generic.isSolflare ? "Solflare" : "Solana wallet", provider: generic });
  }
  return found;
}

export function detectSolanaProviders(): DetectedSolanaWallet[] {
  if (typeof window === "undefined") return [];
  startStandardDiscovery();
  const found: DetectedSolanaWallet[] = [...standardWallets].map((wallet) => ({
    kind: wallet.name,
    icon: wallet.icon,
    provider: adaptStandardWallet(wallet),
  }));
  const seen = new Set(found.map((w) => normalizeWalletName(w.kind)));
  for (const legacy of detectLegacyProviders()) {
    const key = normalizeWalletName(legacy.kind);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(legacy);
  }
  return found;
}

export function hasInjectedSolanaWallet(): boolean {
  return detectSolanaProviders().length > 0;
}

function currentPageUrl(): string {
  return typeof window !== "undefined" ? window.location.href : "https://synexus.pro";
}

function currentOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://synexus.pro";
}

export function phantomBrowseUrl(href = currentPageUrl()): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(currentOrigin())}`;
}

export function solflareBrowseUrl(href = currentPageUrl()): string {
  return `https://solflare.com/ul/v1/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(currentOrigin())}`;
}

/** Open the current page inside a mobile wallet's in-app browser. */
export function walletBrowseLinks(href = currentPageUrl()): { name: string; url: string }[] {
  return [
    { name: "Phantom", url: phantomBrowseUrl(href) },
    { name: "Solflare", url: solflareBrowseUrl(href) },
  ];
}

function rememberWallet(kind: SolanaWalletKind | null): void {
  try {
    if (kind) localStorage.setItem(LAST_WALLET_KEY, kind);
    else localStorage.removeItem(LAST_WALLET_KEY);
  } catch {
    /* storage blocked */
  }
}

function lastWallet(): SolanaWalletKind | null {
  try {
    return localStorage.getItem(LAST_WALLET_KEY);
  } catch {
    return null;
  }
}

export function forgetSolanaWallet(): void {
  rememberWallet(null);
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
    throw new Error("No Solana wallet found. Install a Solana wallet extension or open this page in your wallet's browser.");
  }
  const match = kind ? providers.find((p) => p.kind === kind) : providers[0];
  const picked = match ?? providers[0];
  const result = await picked.provider.connect();
  const address = result.publicKey?.toString() ?? picked.provider.publicKey?.toString();
  if (!address) throw new Error("Wallet did not return a public key.");
  rememberWallet(picked.kind);
  return { address, kind: picked.kind, provider: picked.provider };
}

/** Silently reconnect only the wallet the user last approved, so other wallets never pop up on load. */
export async function tryReconnectSolanaWallet(): Promise<{
  address: string;
  kind: SolanaWalletKind;
  provider: SolanaWalletProvider;
} | null> {
  const remembered = lastWallet();
  const providers = detectSolanaProviders();
  const candidates = remembered
    ? providers.filter((p) => p.kind === remembered)
    : providers.filter((p) => p.kind === "Phantom" || p.kind === "Solflare");
  for (const picked of candidates) {
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
    backpack?: SolanaWalletProvider & { solana?: SolanaWalletProvider };
  }
}
