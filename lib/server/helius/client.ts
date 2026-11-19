/**
 * Server-only Helius connection. The API key stays in this module.
 * Browser wallets keep their own public RPC and never import this file.
 */
import type { HeraIntelEnv } from "../hera/partnerAuth.js";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type HeliusProbe = {
  configured: boolean;
  ok: boolean;
  slot: number | null;
  reason: "ready" | "not_configured" | "unreachable";
};

export type HeliusSignature = {
  signature: string;
  slot: number | null;
  failed: boolean;
  blockTime: number | null;
};

export type HeliusWalletToken = {
  mint: string;
  amount: string;
  decimals: number | null;
};

export type HeliusWallet = {
  ok: boolean;
  lamports: number | null;
  tokens: HeliusWalletToken[];
};

export type HeliusNewToken = {
  mint: string;
  symbol: string | null;
  name: string | null;
};

type FetchLike = typeof fetch;

function keyFrom(env: HeraIntelEnv): string {
  const key = env.HELIUS_API_KEY;
  return typeof key === "string" ? key.trim() : "";
}

export function heliusConfigured(env: HeraIntelEnv): boolean {
  return keyFrom(env).length > 0;
}

export function redactHelius(text: string, env?: HeraIntelEnv): string {
  const key = env ? keyFrom(env) : "";
  let out = text.replace(/api-key=[^&\s"'<>]+/gi, "api-key=redacted");
  if (key.length > 0) out = out.split(key).join("redacted");
  return out;
}

export function isSolanaAddress(value: string): boolean {
  return BASE58.test(value);
}

/** HTTP RPC for server calls. Never send this string to a browser. */
export function heliusHttpEndpoint(env: HeraIntelEnv): string | null {
  const key = keyFrom(env);
  if (!key) return null;
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
}

/** Dev-server websocket. Production browsers do not open this socket. */
export function heliusWsEndpoint(env: HeraIntelEnv): string | null {
  const explicit = typeof env.HELIUS_WS_URL === "string" ? env.HELIUS_WS_URL.trim() : "";
  if (explicit) return explicit;
  const key = keyFrom(env);
  if (!key) return null;
  return `wss://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
}

async function rpc(
  env: HeraIntelEnv,
  method: string,
  params: unknown[],
  fetchImpl: FetchLike,
): Promise<unknown> {
  const endpoint = heliusHttpEndpoint(env);
  if (!endpoint) throw new Error("helius_not_configured");
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "helius_unreachable";
    throw new Error(redactHelius(message, env));
  }
  const payload = (await response.json().catch(() => null)) as { result?: unknown; error?: { message?: unknown } } | null;
  if (!response.ok || !payload || payload.error) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "helius_unreachable";
    throw new Error(redactHelius(message, env));
  }
  return payload.result;
}

export async function probeHelius(env: HeraIntelEnv, fetchImpl: FetchLike = fetch): Promise<HeliusProbe> {
  if (!heliusConfigured(env)) return { configured: false, ok: false, slot: null, reason: "not_configured" };
  try {
    await rpc(env, "getHealth", [], fetchImpl);
    const slot = await rpc(env, "getSlot", [], fetchImpl);
    return {
      configured: true,
      ok: typeof slot === "number" && Number.isFinite(slot),
      slot: typeof slot === "number" ? slot : null,
      reason: typeof slot === "number" ? "ready" : "unreachable",
    };
  } catch {
    return { configured: true, ok: false, slot: null, reason: "unreachable" };
  }
}

export async function recentSignatures(
  env: HeraIntelEnv,
  address: string,
  fetchImpl: FetchLike = fetch,
): Promise<HeliusSignature[]> {
  if (!isSolanaAddress(address)) return [];
  const result = await rpc(env, "getSignaturesForAddress", [address, { limit: 8 }], fetchImpl);
  if (!Array.isArray(result)) return [];
  return result.slice(0, 8).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { signature?: unknown; slot?: unknown; err?: unknown; blockTime?: unknown };
    if (typeof item.signature !== "string" || !item.signature) return [];
    return [{
      signature: item.signature,
      slot: typeof item.slot === "number" ? item.slot : null,
      failed: item.err != null,
      blockTime: typeof item.blockTime === "number" ? item.blockTime : null,
    }];
  });
}

function tokenFromAccount(value: unknown): HeliusWalletToken | null {
  if (!value || typeof value !== "object") return null;
  const parsed = (value as { account?: { data?: { parsed?: { info?: unknown } } } }).account?.data?.parsed?.info;
  if (!parsed || typeof parsed !== "object") return null;
  const info = parsed as { mint?: unknown; tokenAmount?: { amount?: unknown; decimals?: unknown } };
  if (typeof info.mint !== "string" || !isSolanaAddress(info.mint)) return null;
  const amount = info.tokenAmount?.amount;
  if (typeof amount !== "string" || !/^\d+$/.test(amount) || amount === "0") return null;
  const decimals = info.tokenAmount?.decimals;
  return {
    mint: info.mint,
    amount,
    decimals: typeof decimals === "number" ? decimals : null,
  };
}

export async function trackWallet(
  env: HeraIntelEnv,
  address: string,
  fetchImpl: FetchLike = fetch,
): Promise<HeliusWallet> {
  if (!isSolanaAddress(address)) return { ok: false, lamports: null, tokens: [] };
  const balance = await rpc(env, "getBalance", [address], fetchImpl);
  const lamports = balance && typeof balance === "object" && typeof (balance as { value?: unknown }).value === "number"
    ? (balance as { value: number }).value
    : null;
  const tokens: HeliusWalletToken[] = [];
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    if (tokens.length >= 12) break;
    const accounts = await rpc(
      env,
      "getTokenAccountsByOwner",
      [address, { programId }, { encoding: "jsonParsed" }],
      fetchImpl,
    );
    const rows = accounts && typeof accounts === "object" ? (accounts as { value?: unknown }).value : null;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const token = tokenFromAccount(row);
      if (!token) continue;
      tokens.push(token);
      if (tokens.length >= 12) break;
    }
  }
  return { ok: lamports != null, lamports, tokens };
}

export async function discoverNewTokens(
  env: HeraIntelEnv,
  limit = 8,
  fetchImpl: FetchLike = fetch,
): Promise<HeliusNewToken[]> {
  if (!heliusConfigured(env)) return [];
  const cap = Math.max(1, Math.min(limit, 12));
  try {
    const result = await rpc(env, "searchAssets", [{
      page: 1,
      limit: cap,
      tokenType: "fungible",
      sortBy: { sortBy: "created", sortDirection: "desc" },
    }], fetchImpl);
    const items = result && typeof result === "object" ? (result as { items?: unknown }).items : null;
    if (!Array.isArray(items)) return [];
    return items.slice(0, cap).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { id?: unknown; content?: { metadata?: { symbol?: unknown; name?: unknown } } };
      if (typeof row.id !== "string" || !isSolanaAddress(row.id)) return [];
      const symbol = row.content?.metadata?.symbol;
      const name = row.content?.metadata?.name;
      return [{
        mint: row.id,
        symbol: typeof symbol === "string" && symbol.trim() ? symbol.trim().slice(0, 24) : null,
        name: typeof name === "string" && name.trim() ? name.trim().slice(0, 64) : null,
      }];
    });
  } catch {
    return [];
  }
}
