import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveMembership } from "../../../lib/server/membership/resolve.js";
import { signTradeQuote, tradeQuoteMatches } from "../../../lib/server/membership/quoteToken.js";
import { useApiRoute, type ConnectHandler, type ViteDevServer } from "../viteDevServer.js";

type Env = Record<string, string | undefined>;
const LITE_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const LITE_SWAP = "https://lite-api.jup.ag/swap/v1/swap";

function send(res: Pick<ServerResponse, "statusCode" | "setHeader" | "end">, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function feeAccount(env: Env): string {
  return (env.JUPITER_FEE_ACCOUNT || env.VITE_JUPITER_FEE_ACCOUNT || "").trim();
}

function canonicalQuote(quote: Record<string, unknown>, feeBps: number): string {
  return JSON.stringify({
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    feeBps,
  });
}

export async function handleTradeQuote(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const membership = await resolveMembership(req, env);
  if (!membership.authenticated) return send(res, 401, { error: "Sign in to quote a swap." });
  const body = await readJson(req);
  const inputMint = String(body.inputMint ?? "").trim();
  const outputMint = String(body.outputMint ?? "").trim();
  const amount = String(body.amount ?? "").trim();
  if (!inputMint || !outputMint || !amount) return send(res, 400, { error: "Quote needs both tokens and an amount." });
  const account = feeAccount(env);
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(body.slippageBps ?? 50),
    restrictIntermediateTokens: "true",
  });
  if (account && membership.feeBps > 0) params.set("platformFeeBps", String(membership.feeBps));
  const response = await fetch(`${LITE_QUOTE}?${params.toString()}`);
  const quote = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !quote?.outAmount) return send(res, 502, { error: "Jupiter did not return a quote." });
  const token = signTradeQuote(canonicalQuote(quote, membership.feeBps), env);
  if (!token) return send(res, 503, { error: "Swap signing is not configured on the server." });
  send(res, 200, {
    quote,
    platformFeeBps: membership.feeBps,
    platformFeeApplied: Boolean(account && membership.feeBps > 0),
    quoteToken: token,
    tier: membership.tier,
    feeDisclosure: membership.feeDisclosure,
  });
}

export async function handleTradeSwap(req: IncomingMessage, res: ServerResponse, env: Env): Promise<void> {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const membership = await resolveMembership(req, env);
  if (!membership.authenticated) return send(res, 401, { error: "Sign in to swap." });
  const body = await readJson(req);
  const quote = body.quote as Record<string, unknown> | undefined;
  const userPublicKey = String(body.userPublicKey ?? "").trim();
  const quoteToken = String(body.quoteToken ?? "");
  if (!quote || !userPublicKey || !quoteToken) return send(res, 400, { error: "Swap needs a signed quote." });
  if (!tradeQuoteMatches(canonicalQuote(quote, membership.feeBps), quoteToken, env)) {
    return send(res, 409, { error: "This quote does not match the current membership fee. Request a new quote." });
  }
  const account = feeAccount(env);
  const payload: Record<string, unknown> = {
    quoteResponse: quote,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    dynamicSlippage: true,
  };
  if (account && membership.feeBps > 0) payload.feeAccount = account;
  const response = await fetch(LITE_SWAP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as { swapTransaction?: string; error?: string } | null;
  if (!response.ok || !data?.swapTransaction) return send(res, 502, { error: data?.error || "Jupiter did not build the swap." });
  send(res, 200, { swapTransaction: data.swapTransaction, platformFeeBps: membership.feeBps });
}

function routeOf(url: string | undefined): string {
  const parsed = new URL(url ?? "/", "http://localhost");
  return parsed.searchParams.get("__route") || parsed.pathname;
}

async function dispatch(req: IncomingMessage, res: ServerResponse, env: Env) {
  if (routeOf(req.url).endsWith("/swap")) return handleTradeSwap(req, res, env);
  return handleTradeQuote(req, res, env);
}

export function configureTradeApi(server: ViteDevServer, env: Env) {
  const middleware: ConnectHandler = async (req, res) => {
    await dispatch(req, res, env);
  };
  useApiRoute(server, "/api/trade/quote", middleware);
  useApiRoute(server, "/api/trade/swap", middleware);
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return dispatch(req, res, process.env);
}
