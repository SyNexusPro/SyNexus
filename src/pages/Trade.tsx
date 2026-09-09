import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { NonCustodialDisclaimer } from "../components/NonCustodialDisclaimer";
import { isTradingEnabled } from "../config/trading";
import { SYN_MINT, SYN_SYMBOL } from "../config/synToken";
import { useSolanaWallet } from "../hooks/useSolanaWallet";
import { useSynexusPlan } from "../hooks/useSynexusPlan";
import {
  buildJupiterSwapTransaction,
  estimateNetworkCostSol,
  fetchJupiterQuote,
  getMintDecimals,
  jupiterFeeAccount,
  USDC_MINT,
  type JupiterSwapBuild,
  type SwapQuoteView,
} from "../lib/jupiterSwap";
import { JUPITER_SOL_MINT } from "../lib/solanaTradeLinks";
import {
  maxSpendable,
  phantomBrowseUrl,
  shortenAddress,
  toAtomicAmount,
  walletSignAndSend,
} from "../lib/solanaWallet";
import { loadSwapHistory, recordSwapHistory, type SwapHistoryRecord } from "../lib/swapHistory";
import { assessSwapToken, priceImpactGate, type SwapSafetyReport } from "../lib/swapSafety";
import { calculateTradeFeeUsd, formatFeeUsd, formatTradingFeeRate, getTradingFeeBps } from "../lib/tradingFees";
import { lookupTokenByQuery } from "../services/marketDataService";
import type { Token } from "../data/tokens";

type TokenPick = {
  mint: string;
  symbol: string;
  name: string;
  decimals?: number;
};

const SOL_PICK: TokenPick = { mint: JUPITER_SOL_MINT, symbol: "SOL", name: "Solana", decimals: 9 };
const USDC_PICK: TokenPick = { mint: USDC_MINT, symbol: "USDC", name: "USD Coin", decimals: 6 };
const SYN_PICK: TokenPick = { mint: SYN_MINT, symbol: SYN_SYMBOL, name: "SyNexus", decimals: 6 };

function formatAmt(n: number, digits = 6): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: Math.min(digits, 4) });
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
}

function explorerTx(sig: string): string {
  return `https://solscan.io/tx/${sig}`;
}

export function Trade() {
  if (!isTradingEnabled()) {
    return <Navigate to="/hub" replace />;
  }
  return <TradeScreen />;
}

function TradeScreen() {
  const [params] = useSearchParams();
  const plan = useSynexusPlan();
  const wallet = useSolanaWallet();
  const feeBps = getTradingFeeBps(plan);
  const feeAccount = jupiterFeeAccount();

  const [sell, setSell] = useState<TokenPick>(SOL_PICK);
  const [buy, setBuy] = useState<TokenPick>(USDC_PICK);
  const [amount, setAmount] = useState("0.1");
  const [slippageBps, setSlippageBps] = useState(50);
  const [mintQuery, setMintQuery] = useState("");
  const [quote, setQuote] = useState<SwapQuoteView | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [safety, setSafety] = useState<SwapSafetyReport | null>(null);
  const [safetyToken, setSafetyToken] = useState<Token | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [riskAck, setRiskAck] = useState(false);
  const [impactAck, setImpactAck] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [swapBuild, setSwapBuild] = useState<JupiterSwapBuild | null>(null);
  const [signing, setSigning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<SwapHistoryRecord[]>([]);

  useEffect(() => {
    document.title = "Trade · SyNexus";
    return () => {
      document.title = "SyNexus";
    };
  }, []);

  useEffect(() => {
    const mint = params.get("mint")?.trim();
    const side = params.get("side") === "sell" ? "sell" : "buy";
    if (!mint) return;
    const pick: TokenPick = { mint, symbol: shortenAddress(mint, 3), name: mint };
    if (side === "sell") {
      setSell(pick);
      setBuy(SOL_PICK);
    } else {
      setSell(SOL_PICK);
      setBuy(pick);
    }
  }, [params]);

  const analysisMint = buy.mint === JUPITER_SOL_MINT ? sell.mint : buy.mint;

  useEffect(() => {
    let cancelled = false;
    setAnalyzing(true);
    setSafety(null);
    setRiskAck(false);
    setImpactAck(false);
    setConfirmOpen(false);
    void (async () => {
      try {
        const token = await lookupTokenByQuery(analysisMint);
        if (cancelled) return;
        if (!token) {
          setSafetyToken(null);
          setSafety(null);
          return;
        }
        setSafetyToken(token);
        setSafety(assessSwapToken(token));
        setBuy((prev) =>
          prev.mint === token.mintAddress
            ? { ...prev, symbol: token.symbol, name: token.name }
            : prev,
        );
        setSell((prev) =>
          prev.mint === token.mintAddress
            ? { ...prev, symbol: token.symbol, name: token.name }
            : prev,
        );
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisMint]);

  const amountNum = Number(amount);
  const spendable = maxSpendable(sell.mint, wallet.snapshot);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          setQuote(null);
          return;
        }
        setQuoting(true);
        setQuoteError(null);
        try {
          const decimals = sell.decimals ?? (await getMintDecimals(sell.mint));
          const atomic = toAtomicAmount(amountNum, decimals);
          const next = await fetchJupiterQuote({
            inputMint: sell.mint,
            outputMint: buy.mint,
            amountAtomic: atomic,
            slippageBps,
            platformFeeBps: feeBps,
          });
          if (!cancelled) setQuote(next);
        } catch (err) {
          if (!cancelled) {
            setQuote(null);
            setQuoteError(err instanceof Error ? err.message : "Quote failed.");
          }
        } finally {
          if (!cancelled) setQuoting(false);
        }
      })();
    }, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amountNum, sell.mint, sell.decimals, buy.mint, slippageBps, feeBps]);

  useEffect(() => {
    if (!wallet.address) {
      setHistory([]);
      return;
    }
    void loadSwapHistory(wallet.address).then(setHistory);
  }, [wallet.address]);

  const impact = useMemo(
    () => (quote ? priceImpactGate(quote.priceImpactPct) : null),
    [quote],
  );

  const notionalUsd = useMemo(() => {
    if (!quote || !safetyToken) return 0;
    const price = safetyToken.priceUsd;
    if (buy.mint === safetyToken.mintAddress) return quote.outAmountUi * price;
    if (sell.mint === safetyToken.mintAddress) return quote.inAmountUi * price;
    return 0;
  }, [quote, safetyToken, buy.mint, sell.mint]);

  const synexusFeeUsd = calculateTradeFeeUsd(notionalUsd, plan);
  const analysisReady = !analyzing && safety != null;
  const swapLocked =
    !wallet.address ||
    !quote ||
    quoting ||
    analyzing ||
    !safety?.swapAllowed ||
    Boolean(impact?.blocked) ||
    (safety?.requiresRiskAck && !riskAck) ||
    (impact?.requiresAck && !impactAck);

  const swapDisabledReason = useMemo(() => {
    if (!wallet.address) return "Connect a wallet first.";
    if (analyzing) return "Titan is still analyzing this token.";
    if (!safety) return "Titan needs a token analysis before Swap unlocks.";
    if (!safety.swapAllowed) return safety.blockReason ?? "Swap locked by Titan safety.";
    if (quoting) return "Refreshing Jupiter quote…";
    if (!quote) return quoteError ?? "Waiting for a Jupiter route.";
    if (impact?.blocked) return impact.label;
    if (safety.requiresRiskAck && !riskAck) return "Acknowledge the high-risk warning to continue.";
    if (impact?.requiresAck && !impactAck) return "Acknowledge price impact to continue.";
    return null;
  }, [wallet.address, analyzing, safety, quoting, quote, quoteError, impact, riskAck, impactAck]);

  const flip = useCallback(() => {
    setSell(buy);
    setBuy(sell);
    setAmount("");
  }, [buy, sell]);

  async function applyMintQuery() {
    const q = mintQuery.trim();
    if (!q) return;
    const token = await lookupTokenByQuery(q);
    if (!token?.mintAddress) {
      setStatus("Token not found. Paste a Solana mint address.");
      return;
    }
    setBuy({ mint: token.mintAddress, symbol: token.symbol, name: token.name });
    setMintQuery("");
    setStatus(null);
  }

  async function openConfirm() {
    if (swapLocked || !wallet.address || !quote) return;
    setConfirmOpen(true);
    setSwapBuild(null);
    setStatus(null);
    try {
      const build = await buildJupiterSwapTransaction({
        quote: quote.quote,
        userPublicKey: wallet.address,
      });
      setSwapBuild(build);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not build the swap transaction.");
    }
  }

  async function signSwap() {
    if (!wallet.provider || !wallet.address || !quote || !swapBuild) return;
    setSigning(true);
    setStatus(null);
    try {
      const signature = await walletSignAndSend(wallet.provider, swapBuild.swapTransaction);
      await recordSwapHistory({
        walletAddress: wallet.address,
        signature,
        inputMint: sell.mint,
        outputMint: buy.mint,
        inputSymbol: sell.symbol,
        outputSymbol: buy.symbol,
        inputAmount: String(quote.inAmountUi),
        outputAmountEst: String(quote.outAmountUi),
        status: "confirmed",
        priceImpactPct: quote.priceImpactPct,
      });
      setStatus(`Confirmed ${shortenAddress(signature, 6)}`);
      setConfirmOpen(false);
      const rows = await loadSwapHistory(wallet.address);
      setHistory(rows);
      await wallet.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet rejected the transaction.";
      setStatus(message);
      await recordSwapHistory({
        walletAddress: wallet.address,
        signature: null,
        inputMint: sell.mint,
        outputMint: buy.mint,
        inputSymbol: sell.symbol,
        outputSymbol: buy.symbol,
        inputAmount: amount,
        outputAmountEst: quote.outAmountUi ? String(quote.outAmountUi) : "",
        status: "failed",
        priceImpactPct: quote.priceImpactPct,
      });
    } finally {
      setSigning(false);
    }
  }

  const presets: TokenPick[] = [
    SOL_PICK,
    USDC_PICK,
    SYN_PICK,
    ...(wallet.snapshot?.tokens.slice(0, 6).map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
    })) ?? []),
  ].filter((row, i, all) => all.findIndex((x) => x.mint === row.mint) === i);

  return (
    <div className="page trade-page">
      <section className="trade-page__hero marketing-panel">
        <p className="trade-page__eyebrow">SyNexus Trade</p>
        <h1 className="trade-page__title">Swap on Solana</h1>
        <p className="trade-page__lede">
          Jupiter finds the route. Titan reviews the token. Your wallet signs — SyNexus never holds keys,
          seeds, or balances.
        </p>
      </section>

      <section className="trade-page__card">
        <h2>Wallet</h2>
        {wallet.address && wallet.snapshot ? (
          <>
            <p className="trade-page__wallet">
              {wallet.kind} · <span>{shortenAddress(wallet.address)}</span>
            </p>
            <p className="trade-page__balance">
              {formatAmt(wallet.snapshot.sol, 4)} SOL
            </p>
            {wallet.snapshot.tokens.length ? (
              <ul className="trade-page__tokens">
                {wallet.snapshot.tokens.slice(0, 8).map((tok) => (
                  <li key={tok.mint}>
                    <button
                      type="button"
                      onClick={() =>
                        setSell({ mint: tok.mint, symbol: tok.symbol, name: tok.name, decimals: tok.decimals })
                      }
                    >
                      {formatAmt(tok.uiAmount, 4)} {tok.symbol}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="trade-page__hint">No SPL token balances yet.</p>
            )}
            <button type="button" className="trade-page__cta trade-page__cta--secondary" onClick={() => void wallet.disconnect()}>
              Disconnect
            </button>
          </>
        ) : wallet.available ? (
          <>
            <p className="trade-page__hint">Connect Phantom or Solflare. The private key stays in the wallet.</p>
            <div className="trade-page__actions">
              {(wallet.kinds.length ? wallet.kinds : (["Phantom", "Solflare"] as const)).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="trade-page__cta"
                  disabled={wallet.busy}
                  onClick={() => void wallet.connect(k)}
                >
                  Connect {k}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="trade-page__hint">
              No wallet extension detected. Install Phantom or Solflare, or open this page inside the wallet
              browser.
            </p>
            <a className="trade-page__cta" href={phantomBrowseUrl()} target="_blank" rel="noopener noreferrer">
              Open in Phantom
            </a>
          </>
        )}
        {wallet.error ? <p className="trade-page__error">{wallet.error}</p> : null}
      </section>

      <section className="trade-page__card">
        <h2>Swap</h2>
        <p className="trade-page__hint">Routes come from Jupiter. SyNexus does not run its own pool.</p>
        <label className="trade-page__field">
          You sell
          <div className="trade-page__row">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
            />
            <select
              value={sell.mint}
              onChange={(e) => {
                const next = presets.find((p) => p.mint === e.target.value);
                if (next) setSell(next);
              }}
            >
              {presets.map((p) => (
                <option key={`sell-${p.mint}`} value={p.mint}>
                  {p.symbol}
                </option>
              ))}
            </select>
          </div>
          {wallet.snapshot ? (
            <button
              type="button"
              className="trade-page__max"
              onClick={() => setAmount(String(Number(spendable.toFixed(6))))}
            >
              Max {formatAmt(spendable, 4)} {sell.symbol}
            </button>
          ) : null}
        </label>
        <button type="button" className="trade-page__flip" onClick={flip} aria-label="Flip tokens">
          ↕
        </button>
        <label className="trade-page__field">
          You receive
          <div className="trade-page__row">
            <input readOnly value={quote ? formatAmt(quote.outAmountUi) : quoting ? "…" : ""} placeholder="Quote" />
            <select
              value={buy.mint}
              onChange={(e) => {
                const next = presets.find((p) => p.mint === e.target.value);
                if (next) setBuy(next);
              }}
            >
              {presets.map((p) => (
                <option key={`buy-${p.mint}`} value={p.mint}>
                  {p.symbol}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="trade-page__field">
          Token mint or ticker
          <div className="trade-page__row">
            <input
              value={mintQuery}
              onChange={(e) => setMintQuery(e.target.value)}
              placeholder="Paste mint or search ticker"
            />
            <button type="button" className="trade-page__cta trade-page__cta--compact" onClick={() => void applyMintQuery()}>
              Load
            </button>
          </div>
        </label>
        <label className="trade-page__field">
          Slippage
          <select value={slippageBps} onChange={(e) => setSlippageBps(Number(e.target.value))}>
            <option value={50}>0.5%</option>
            <option value={100}>1%</option>
            <option value={300}>3%</option>
          </select>
        </label>
        {quoteError ? <p className="trade-page__error">{quoteError}</p> : null}
        {quote ? (
          <ul className="trade-page__facts">
            <li>Est. output {formatAmt(quote.outAmountUi)} {buy.symbol}</li>
            <li>Min received {formatAmt(quote.minOutUi)} {buy.symbol}</li>
            <li>Price impact {impact?.label ?? `${quote.priceImpactPct.toFixed(2)}%`}</li>
            <li>Jupiter hops {quote.routeHops || 1}</li>
          </ul>
        ) : null}
      </section>

      <section className={`trade-page__card trade-page__card--safety${safety && !safety.swapAllowed ? " is-blocked" : ""}`}>
        <h2>Titan AI safety</h2>
        {analyzing ? <p className="trade-page__hint">Running SyNexus analysis…</p> : null}
        {analysisReady && safety ? (
          <>
            <p className={`trade-page__verdict trade-page__verdict--${safety.verdict.toLowerCase()}`}>
              {safety.headline} · {safety.riskLabel}
            </p>
            <p>{safety.explanation}</p>
            <ul className="trade-page__facts">
              <li>Risk score {safety.card.riskScore}/100</li>
              <li>Rug / scam {safety.card.rugPullLabel}</li>
              <li>Liquidity health {safety.card.liquidityHealth}/100 · {formatUsd(safety.token.liquidityUsd ?? 0)}</li>
              <li>Price impact {quote ? `${Math.abs(quote.priceImpactPct).toFixed(2)}%` : "—"}</li>
              <li>Titan {safety.discovery.summary}</li>
            </ul>
            {safety.requiresRiskAck ? (
              <label className="trade-page__check">
                <input type="checkbox" checked={riskAck} onChange={(e) => setRiskAck(e.target.checked)} />
                I understand Titan rates this high risk and may still lose the full amount.
              </label>
            ) : null}
            {impact?.requiresAck ? (
              <label className="trade-page__check">
                <input type="checkbox" checked={impactAck} onChange={(e) => setImpactAck(e.target.checked)} />
                I accept this price impact.
              </label>
            ) : null}
            {safety.blockReason ? <p className="trade-page__error">{safety.blockReason}</p> : null}
          </>
        ) : !analyzing ? (
          <p className="trade-page__hint">Paste a mint so Titan can score risk, liquidity, and rug signals.</p>
        ) : null}
        <button type="button" className="trade-page__cta" disabled={swapLocked} onClick={() => void openConfirm()}>
          {swapLocked ? "Swap locked" : "Review swap"}
        </button>
        {swapDisabledReason && swapLocked ? <p className="trade-page__hint">{swapDisabledReason}</p> : null}
      </section>

      {confirmOpen && quote ? (
        <section className="trade-page__card trade-page__card--confirm" role="dialog" aria-labelledby="trade-confirm-title">
          <h2 id="trade-confirm-title">Confirm swap</h2>
          <ul className="trade-page__facts">
            <li>
              Selling {formatAmt(quote.inAmountUi)} {sell.symbol}
            </li>
            <li>
              Receiving ~{formatAmt(quote.outAmountUi)} {buy.symbol}
            </li>
            <li>Min received {formatAmt(quote.minOutUi)} {buy.symbol}</li>
            <li>Price impact {Math.abs(quote.priceImpactPct).toFixed(2)}%</li>
            <li>Network cost ~{formatAmt(estimateNetworkCostSol(swapBuild), 6)} SOL</li>
            <li>
              SyNexus fee {formatTradingFeeRate(plan)}
              {quote.platformFeeApplied
                ? ` · ~${formatFeeUsd(synexusFeeUsd)}`
                : feeAccount
                  ? ""
                  : " · fee wallet not configured this session"}
            </li>
          </ul>
          <p className="trade-page__hint">
            Your {wallet.kind ?? "wallet"} will ask you to approve. SyNexus cannot sign this for you.
          </p>
          <div className="trade-page__actions">
            <button type="button" className="trade-page__cta" disabled={signing || !swapBuild} onClick={() => void signSwap()}>
              {signing ? "Waiting for wallet…" : swapBuild ? "Sign in wallet" : "Building transaction…"}
            </button>
            <button type="button" className="trade-page__cta trade-page__cta--secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {status ? <p className="trade-page__message">{status}</p> : null}

      <section className="trade-page__card">
        <h2>Recent swaps</h2>
        <p className="trade-page__hint">Public facts only: wallet, signature, pair, amount, time, status.</p>
        {history.length ? (
          <ul className="trade-page__history">
            {history.map((row) => (
              <li key={row.id}>
                <span>
                  {row.inputSymbol}→{row.outputSymbol} · {formatAmt(Number(row.inputAmount))} · {row.status}
                </span>
                {row.signature ? (
                  <a href={explorerTx(row.signature)} target="_blank" rel="noopener noreferrer">
                    {shortenAddress(row.signature, 4)}
                  </a>
                ) : (
                  <span>{new Date(row.timestamp).toLocaleString()}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="trade-page__hint">No swaps on this wallet yet.</p>
        )}
      </section>

      <NonCustodialDisclaimer />
      <p className="trade-page__footnote">
        Not financial advice. In-app swap is gated off Play Store builds until a separate Google financial-feature
        review. External Jupiter links on token pages stay unchanged.
      </p>
      <p className="trade-page__footnote">
        <Link to="/hub">Back to Hub</Link>
      </p>
    </div>
  );
}
