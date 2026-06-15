import { useState } from "react";
import { Link } from "react-router-dom";
import type { Token } from "../data/tokens";
import { analyzeShouldIBuy, verdictTone } from "../lib/shouldIBuy";
import { lookupTokenByQuery } from "../services/marketDataService";
import { TradeIntelligenceScorecard } from "./TradeIntelligenceScorecard";

type Props = {
  poolTokens?: Token[];
};

export function ShouldIBuyVerdict({ token }: { token: Token }) {
  const result = analyzeShouldIBuy(token);
  const tone = verdictTone(result.verdict);

  return (
    <div className={`should-i-buy__verdict should-i-buy__verdict--${tone}`}>
      <p className="should-i-buy__verdict-label">Should I buy {token.symbol}?</p>
      <p className="should-i-buy__verdict-headline">{result.headline}</p>
      <p className="should-i-buy__verdict-copy">{result.explanation}</p>
    </div>
  );
}

export function ShouldIBuyPanel({ poolTokens = [] }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof analyzeShouldIBuy> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    const q = query.trim();
    if (!q) return;
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
    } catch {
      setError("Lookup failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const tone = result ? verdictTone(result.verdict) : null;

  return (
    <section className="should-i-buy" aria-labelledby="should-i-buy-title">
      <div className="should-i-buy__head">
        <p className="should-i-buy__eyebrow">Instant read</p>
        <h2 className="should-i-buy__title" id="should-i-buy-title">
          Should I buy this?
        </h2>
        <p className="should-i-buy__lede">
          Paste a token mint or symbol. Synexus answers in plain English — watch, high risk, or avoid.
        </p>
      </div>
      <div className="should-i-buy__form">
        <input
          className="should-i-buy__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mint address or symbol (e.g. BONK)"
          aria-label="Token to analyze"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAnalyze();
          }}
        />
        <button type="button" className="should-i-buy__button" disabled={busy} onClick={() => void handleAnalyze()}>
          {busy ? "Scanning…" : "Analyze"}
        </button>
      </div>
      {error ? <p className="should-i-buy__error">{error}</p> : null}
      {result ? (
        <div className={`should-i-buy__result should-i-buy__result--${tone}`}>
          <div className="should-i-buy__result-top">
            <div>
              <p className="should-i-buy__token">
                {result.token.name} ({result.token.symbol})
              </p>
              <p className={`should-i-buy__headline should-i-buy__headline--${tone}`}>{result.headline}</p>
            </div>
            {result.token.id ? (
              <Link to={`/token/${result.token.id}`} className="should-i-buy__link">
                Open token →
              </Link>
            ) : null}
          </div>
          <p className="should-i-buy__explanation">{result.explanation}</p>
          <TradeIntelligenceScorecard token={result.token} compact />
        </div>
      ) : null}
    </section>
  );
}
