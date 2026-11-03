/**
 * Compares a public Jupiter round-trip quote with Alexus's GMGN fee schedule.
 * Quote only. This never calls a swap, signing, or order endpoint.
 */
const SOL_MINT = "So11111111111111111111111111111111111111112";
const LITE_QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote";
const KEYED_QUOTE_URL = "https://api.jup.ag/swap/v1/quote";
const COMPARE_SOL = 0.1;
const GMGN_FEE_EACH_SIDE_PCT = 1;

type QuoteEnv = { JUPITER_API_KEY?: string };

export type RouteComparison = {
  advisoryOnly: true;
  executesTrades: false;
  walletSigning: false;
  sizeSol: number;
  jupiterRoundTripLossPct: number | null;
  gmgnFeeSchedulePct: number;
  networkFeePct: null;
  note: string;
};

type QuoteBody = { outAmount?: string; error?: string };
type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export function unavailableRoute(reason: string): RouteComparison {
  return {
    advisoryOnly: true,
    executesTrades: false,
    walletSigning: false,
    sizeSol: COMPARE_SOL,
    jupiterRoundTripLossPct: null,
    gmgnFeeSchedulePct: GMGN_FEE_EACH_SIDE_PCT * 2,
    networkFeePct: null,
    note: `${reason} GMGN's fee schedule is ${GMGN_FEE_EACH_SIDE_PCT}% on the buy and ${GMGN_FEE_EACH_SIDE_PCT}% on the sell. Network fees were not measured. No order was placed.`,
  };
}

export function compareQuotedRoute(solIn: bigint, solOut: bigint | null): RouteComparison {
  if (solIn <= 0n || solOut === null || solOut <= 0n) {
    return unavailableRoute("Jupiter did not return both legs of the quote.");
  }
  const loss = Number(solIn - solOut) / Number(solIn) * 100;
  if (!Number.isFinite(loss)) return unavailableRoute("Jupiter quote amounts were not usable.");
  const gmgn = GMGN_FEE_EACH_SIDE_PCT * 2;
  return {
    advisoryOnly: true,
    executesTrades: false,
    walletSigning: false,
    sizeSol: COMPARE_SOL,
    jupiterRoundTripLossPct: Number(loss.toFixed(4)),
    gmgnFeeSchedulePct: gmgn,
    networkFeePct: null,
    note: `Jupiter round trip on ${COMPARE_SOL} SOL loses ${loss.toFixed(2)}% to the pool. Sending that route through GMGN adds the published ${GMGN_FEE_EACH_SIDE_PCT}% buy fee and ${GMGN_FEE_EACH_SIDE_PCT}% sell fee (about ${gmgn.toFixed(2)}% of the position). Network fees were not measured. This quote was not sent.`,
  };
}

function quoteHeaders(env: QuoteEnv): Record<string, string> | undefined {
  const key = env.JUPITER_API_KEY?.trim();
  if (!key) return undefined;
  return { "x-api-key": key };
}

function quoteUrl(env: QuoteEnv, inputMint: string, outputMint: string, amount: string): string {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: "50",
    restrictIntermediateTokens: "true",
  });
  const base = env.JUPITER_API_KEY?.trim() ? KEYED_QUOTE_URL : LITE_QUOTE_URL;
  return `${base}?${params.toString()}`;
}

async function readQuote(
  fetchImpl: FetchImpl,
  url: string,
  headers?: Record<string, string>,
): Promise<bigint | null> {
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return null;
  const body = await response.json() as QuoteBody;
  if (!body.outAmount || !/^\d+$/.test(body.outAmount)) return null;
  try {
    return BigInt(body.outAmount);
  } catch {
    return null;
  }
}

export async function compareSolanaRoute(
  mint: string,
  env: QuoteEnv = {},
  fetchImpl: FetchImpl = fetch,
): Promise<RouteComparison> {
  const solIn = BigInt(Math.round(COMPARE_SOL * 1_000_000_000));
  const headers = quoteHeaders(env);
  try {
    const bought = await readQuote(fetchImpl, quoteUrl(env, SOL_MINT, mint, solIn.toString()), headers);
    if (bought === null) return unavailableRoute("Jupiter buy quote was not retrieved.");
    const sold = await readQuote(fetchImpl, quoteUrl(env, mint, SOL_MINT, bought.toString()), headers);
    return compareQuotedRoute(solIn, sold);
  } catch {
    return unavailableRoute("Jupiter quote was not retrieved.");
  }
}
