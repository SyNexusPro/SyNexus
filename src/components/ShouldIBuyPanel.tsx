import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Token } from "../data/tokens";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { guardTokenScan } from "../lib/securityBot";
import { analyzeShouldIBuy, verdictBeginnerMeta, verdictTone } from "../lib/shouldIBuy";
import { lookupTokenByQuery } from "../services/marketDataService";
import { ShareScanButton } from "./ShareScanButton";
import { ScanHealthPanel } from "./ScanHealthPanel";
import { TokenLogo } from "./TokenLogo";

const EASY_EXAMPLES = ["BONK", "SYN", "SOL"] as const;

type Props = {
  poolTokens?: Token[];
  /** Deep link: /?scan=BONK auto-runs once on load */
  initialScan?: string;
};

export function ShouldIBuyVerdict({ token }: { token: Token }) {
  const { isSimple } = useSynexusUIMode();
  const result = analyzeShouldIBuy(token);
  const tone = verdictTone(result.verdict);
  const beginner = verdictBeginnerMeta(result.verdict);

  return (
    <div className={`should-i-buy__verdict should-i-buy__verdict--${tone}${isSimple ? " should-i-buy__verdict--easy-wrap" : ""}`}>
      {isSimple ? (
        <div className="should-i-buy__verdict--easy">
          <span className="should-i-buy__verdict-orb" aria-hidden>
            {beginner.icon}
          </span>
          <div>
            <p className="should-i-buy__verdict-label">Should I buy {token.symbol}?</p>
            <p className="should-i-buy__verdict-headline">{beginner.label}</p>
            <p className="should-i-buy__verdict-copy">{beginner.hint}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="should-i-buy__verdict-label">Should I buy {token.symbol}?</p>
          <p className="should-i-buy__verdict-headline">{result.headline}</p>
          <p className="should-i-buy__verdict-copy">{result.explanation}</p>
        </>
      )}
      <ShareScanButton result={result} className="should-i-buy__share" />
    </div>
  );
}

export function ShouldIBuyPanel({ poolTokens = [], initialScan = "" }: Props) {
  const { isSimple } = useSynexusUIMode();
  const [query, setQuery] = useState(initialScan);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof analyzeShouldIBuy> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranInitialScan = useRef(false);
  const clearScanFromUrl = useRef(Boolean(initialScan.trim()));

  useEffect(() => {
    const q = initialScan.trim();
    if (!q || ranInitialScan.current) return;
    ranInitialScan.current = true;
    setQuery(q);
    void handleAnalyze(q);
  }, [initialScan]);

  async function handleAnalyze(nextQuery?: string) {
    const q = (nextQuery ?? query).trim();
    if (!q) return;

    const scanGuard = guardTokenScan(q);
    if (!scanGuard.allowed) {
      setError(scanGuard.message ?? "Scan blocked — slow down and try again.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await lookupTokenByQuery(q, poolTokens);
      if (!token) {
        setError("Token not found. Paste a Solana mint or try a symbol like BONK.");
        return;
      }
      setResult(analyzeShouldIBuy(token));
      if (clearScanFromUrl.current && typeof window !== "undefined") {
        clearScanFromUrl.current = false;
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      setError("Lookup failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function tryExample(symbol: string) {
    setQuery(symbol);
    void handleAnalyze(symbol);
  }

  const tone = result ? verdictTone(result.verdict) : null;
  const beginner = result ? verdictBeginnerMeta(result.verdict) : null;

  return (
    <section
      className={`should-i-buy${isSimple ? " should-i-buy--easy" : ""}`}
      aria-labelledby="should-i-buy-title"
    >
      <div className="should-i-buy__scan-ring" aria-hidden />
      <div className="should-i-buy__head">
        <p className="should-i-buy__eyebrow">{isSimple ? "Step 1 · Scan" : "Instant read"}</p>
        <h2 className="should-i-buy__title" id="should-i-buy-title">
          Should I buy this?
        </h2>
        <p className="should-i-buy__lede">
          {isSimple
            ? "Paste any Solana token below. SyNexus answers in plain English — no charts required."
            : "Paste a token mint or symbol. SyNexus answers in plain English — watch, high risk, or avoid."}
        </p>
      </div>
      {isSimple ? (
        <div className="should-i-buy__examples" role="group" aria-label="Try an example token">
          <span className="should-i-buy__examples-label">Try an example</span>
          {EASY_EXAMPLES.map((symbol) => (
            <button
              key={symbol}
              type="button"
              className="should-i-buy__chip"
              disabled={busy}
              onClick={() => tryExample(symbol)}
            >
              {symbol}
            </button>
          ))}
        </div>
      ) : null}
      <div className="should-i-buy__form">
        <input
          className="should-i-buy__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isSimple ? "Paste token name or mint address…" : "Mint address or symbol (e.g. BONK)"}
          aria-label="Token to analyze"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAnalyze();
          }}
        />
        <button type="button" className="should-i-buy__button" disabled={busy} onClick={() => void handleAnalyze()}>
          {busy ? "Scanning…" : isSimple ? "Scan now" : "Analyze"}
        </button>
      </div>
      {error ? <p className="should-i-buy__error">{error}</p> : null}
      {result && beginner ? (
        <div className={`should-i-buy__result should-i-buy__result--${tone}${isSimple ? " should-i-buy__result--easy" : ""}`}>
          <div className={isSimple ? "should-i-buy__result-easy-top" : "should-i-buy__result-top should-i-buy__result-top--scan"}>
            <TokenLogo token={result.token} size="md" className="should-i-buy__logo" />
            <div className="should-i-buy__result-copy">
              {isSimple ? (
                <>
                  <span className="should-i-buy__verdict-orb should-i-buy__verdict-orb--inline" aria-hidden>
                    {beginner.icon}
                  </span>
                  <p className="should-i-buy__token">
                    {result.token.name} ({result.token.symbol})
                  </p>
                  <p className={`should-i-buy__headline should-i-buy__headline--${tone}`}>{beginner.label}</p>
                  <p className="should-i-buy__beginner-hint">{beginner.hint}</p>
                </>
              ) : (
                <>
                  <p className="should-i-buy__token">
                    {result.token.name} ({result.token.symbol})
                  </p>
                  <p className={`should-i-buy__headline should-i-buy__headline--${tone}`}>{result.headline}</p>
                  {result.token.id ? (
                    <Link to={`/token/${result.token.id}`} className="should-i-buy__link">
                      Open token →
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <ScanHealthPanel token={result.token} />

          <p className="should-i-buy__explanation">{result.explanation}</p>

          {isSimple && result.token.id ? (
            <Link to={`/token/${result.token.id}`} className="should-i-buy__easy-next">
              See full token page →
            </Link>
          ) : null}
          <ShareScanButton result={result} className="should-i-buy__share" />
        </div>
      ) : null}
    </section>
  );
}
