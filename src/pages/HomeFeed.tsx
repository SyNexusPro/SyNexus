import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TokenCard } from "../components/TokenCard";
import { sampleTokens, type Token } from "../data/tokens";
import { getWatcherIdleMessage } from "../lib/watcherVoice";
import { fetchMvpTokenFeed } from "../services/marketDataService";

const getWatcherMessage = (status: string) => {
  if (status === "safe") {
    return "The Watcher sees no immediate threat.";
  }
  if (status === "warning") {
    return "The Watcher detected unstable activity.";
  }
  if (status === "danger") {
    return "The Watcher advises caution. Multiple risk signals detected.";
  }
  return "The Watcher is scanning the network...";
};

export function HomeFeed() {
  const [allTokens, setAllTokens] = useState<Token[]>(sampleTokens);
  const [trendingTokens, setTrendingTokens] = useState<Token[]>(
    sampleTokens
      .slice()
      .sort((a, b) => b.change24hPct - a.change24hPct)
      .slice(0, 3),
  );
  const [guardianAlerts, setGuardianAlerts] = useState<Token[]>(
    sampleTokens.filter((token) => token.guardianRisk !== "SAFE"),
  );
  const [saferTokens, setSaferTokens] = useState<Token[]>(
    sampleTokens.filter((token) => token.guardianRisk === "SAFE"),
  );
  const [feedSource, setFeedSource] = useState<"live" | "mock">("mock");
  const [dexLiveCount, setDexLiveCount] = useState(0);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [watcherIdle, setWatcherIdle] = useState(getWatcherIdleMessage(Date.now()));
  const [coinSearch, setCoinSearch] = useState("");

  useEffect(() => {
    setFeedError(null);
    setWatcherIdle(getWatcherIdleMessage(Date.now()));
    fetchMvpTokenFeed()
      .then((data) => {
        setAllTokens(data.all);
        setTrendingTokens(data.trending);
        setGuardianAlerts(data.alerts);
        setSaferTokens(data.verified);
        setFeedSource(data.source);
        setDexLiveCount(data.dexLiveCount);
      })
      .catch((err: unknown) => {
        setFeedError(err instanceof Error ? err.message : "Failed to load market data.");
      })
      .finally(() => setFeedLoading(false));
  }, []);

  const searchedTokens = useMemo(() => {
    const query = coinSearch.trim().toLowerCase();
    if (!query) return [];

    return allTokens.filter((token) =>
      [token.name, token.symbol, token.mintAddress ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [allTokens, coinSearch]);

  return (
    <div className="page">
      <section className="landing-hero">
        <p className="landing-hero__eyebrow">HiveMind AI Watchers</p>
        <h1 className="landing-hero__headline">
          Detect risky tokens before you buy.
        </h1>
        <p className="landing-hero__subtext">
          AI Watchers scan tokens, detect risk, track whales, flag scams, and help you move before
          the crowd sees the danger.
        </p>
        <p className="landing-hero__hook">Before the rug. Before the crash.</p>
        <div className="landing-hero__actions">
          <Link to="/pulse">Start Free</Link>
          <Link to="/pulse" className="landing-hero__actions--pro">
            Upgrade to Pro
          </Link>
          <Link to="/hub" className="landing-hero__actions--hub">
            Ecosystem hub
          </Link>
        </div>
        <div className="neural-hero-art" aria-hidden>
          <span className="neural-node neural-node--left" />
          <span className="neural-node neural-node--mid-left" />
          <img className="neural-brain-logo neural-brain-logo--art" src="/hivemind-logo-art.png" alt="" />
          <span className="neural-node neural-node--mid-right" />
          <span className="neural-node neural-node--right" />
        </div>
      </section>

      <section className="landing-info-grid">
        <article className="landing-info-card">
          <p className="landing-info-card__tag">What it does</p>
          <h2>AI Watchers scan the market for danger.</h2>
          <p>
            HiveMind checks token movement, liquidity behavior, volume spikes, wallet activity, and
            community reports before you make a move.
          </p>
        </article>
        <article className="landing-info-card">
          <p className="landing-info-card__tag">Risk signals</p>
          <h2>Detect risks. Track whales. Flag scams.</h2>
          <p>
            Morpheus watches hype, Surge catches volume spikes, Whale Watcher follows big wallets,
            and NEO reports what the hive needs to know.
          </p>
        </article>
        <article className="landing-info-card landing-info-card--warning">
          <p className="landing-info-card__tag">Why it matters</p>
          <h2>Bad tokens move fast.</h2>
          <p>
            Scam launches, rug pulls, sudden dumps, and whale exits can hit before most traders see
            the warning. HiveMind is built to surface those signals early.
          </p>
        </article>
      </section>

      <section className="landing-pricing">
        <div className="token-section__head">
          <h2 className="token-section__title">Pricing</h2>
          <p className="token-section__lede">Start free. Upgrade when you want deeper signals.</p>
        </div>
        <div className="landing-pricing__grid">
          <article className="landing-pricing-card">
            <p className="landing-pricing-card__tier">Free</p>
            <h3>$0</h3>
            <p>Basic token search, Watcher previews, and risk snapshots.</p>
            <Link to="/pulse">Start Free</Link>
          </article>
          <article className="landing-pricing-card landing-pricing-card--pro">
            <p className="landing-pricing-card__tier">Pro</p>
            <h3>$29.99/mo</h3>
            <p>Deeper Watcher signals, whale tracking, paid alerts, and stronger risk intelligence.</p>
            <Link to="/pulse">Upgrade to Pro</Link>
          </article>
        </div>
      </section>

      <section className="guardian-banner">
        <div className="guardian-banner__head">
          <p className="guardian-banner__eyebrow">WATCHERS OF THE HIVE</p>
          <span className="guardian-banner__live">LIVE</span>
        </div>
        <p className="guardian-banner__message">
          {watcherIdle} Hive protection system active.
        </p>
        <p className="guardian-banner__source">
          Data source: {feedSource === "live" ? "DexScreener live feed" : "Mock fallback feed"}
        </p>
        <p className="guardian-banner__source">Live pairs synced: {dexLiveCount}</p>
        {feedLoading ? (
          <p className="feed-status feed-status--loading">{getWatcherMessage("idle")}</p>
        ) : null}
        {feedError ? <p className="feed-status feed-status--error">{feedError}</p> : null}
      </section>

      <section className="coin-search-panel">
        <div className="token-section__head">
          <h2 className="token-section__title">Search a coin</h2>
          <p className="token-section__lede">Find a token, then choose Buy, Sell, or Stake</p>
        </div>
        <label className="coin-search-panel__label" htmlFor="coin-search">
          Coin name, ticker, or mint
        </label>
        <input
          id="coin-search"
          className="coin-search-panel__input"
          value={coinSearch}
          onChange={(event) => setCoinSearch(event.target.value)}
          placeholder="Search HIVE, SOL, BONK..."
        />
        {coinSearch.trim() ? (
          searchedTokens.length ? (
            <ul className="token-list coin-search-panel__results">
              {searchedTokens.map((token) => (
                <li key={`search-${token.id}`}>
                  <TokenCard token={token} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="coin-search-panel__empty">
              No coin found in the current Hive feed. Try a ticker like SOL, HIVE, BONK, or PEPE.
            </p>
          )
        ) : null}
      </section>

      <section className="phantom-promo">
        <div className="phantom-promo__logo-wrap">
          <img className="phantom-promo__logo" src="/phantom-wallet.svg" alt="Phantom Wallet" />
        </div>
        <div className="phantom-promo__content">
          <p className="phantom-promo__eyebrow">Solana wallet ready</p>
          <h2>Trade with Phantom Wallet.</h2>
          <p>
            Connect your Solana flow with Phantom for buying, selling, swapping, and managing tokens
            from one trusted wallet.
          </p>
          <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer">
            Get Phantom Wallet
          </a>
        </div>
      </section>

      <section className="hive-vision">
        <div className="hive-vision__head">
          <p className="hive-vision__eyebrow">Hivemind Security Grid</p>
          <h2 className="hive-vision__title">Built to be the safest Solana trading command center.</h2>
          <p className="hive-vision__copy">
            AI risk modeling, crowd intelligence, and real-time Guardian alerts work as one system.
          </p>
        </div>
        <div className="hive-vision__grid">
          <article className="hive-vision-card">
            <p className="hive-vision-card__icon">AI</p>
            <p className="hive-vision-card__title">AI Detection</p>
            <p className="hive-vision-card__body">
              Pattern detection scans volatility, liquidity shifts, and suspicious transaction behavior.
            </p>
          </article>
          <article className="hive-vision-card">
            <p className="hive-vision-card__icon">COM</p>
            <p className="hive-vision-card__title">Community Protection</p>
            <p className="hive-vision-card__body">
              Reports from traders feed into Guardian scoring so risky tokens are flagged faster.
            </p>
          </article>
          <article className="hive-vision-card">
            <p className="hive-vision-card__icon">RT</p>
            <p className="hive-vision-card__title">Real-Time Alerts</p>
            <p className="hive-vision-card__body">
              Live warnings fire immediately when confidence drops or danger signals accelerate.
            </p>
          </article>
        </div>
      </section>

      <section className="token-section">
        <div className="token-section__head">
          <h2 className="token-section__title">Trending Tokens</h2>
          <p className="token-section__lede">Fast movers across the Hive feed</p>
        </div>
        <ul className="token-list">
          {trendingTokens.map((token) => (
            <li key={`trend-${token.id}`}>
              <TokenCard token={token} />
            </li>
          ))}
        </ul>
      </section>

      <section className="token-section">
        <div className="token-section__head">
          <h2 className="token-section__title">Guardian Alerts</h2>
          <p className="token-section__lede">
            Warning and danger signals that need attention
          </p>
        </div>
        <ul className="token-list">
          {guardianAlerts.map((token) => (
            <li key={`alert-${token.id}`}>
              <TokenCard token={token} />
            </li>
          ))}
        </ul>
      </section>

      <section className="token-section">
        <div className="token-section__head">
          <h2 className="token-section__title">Verified / Safer Tokens</h2>
          <p className="token-section__lede">
            Tokens currently classified as lower risk by Guardian
          </p>
        </div>
        <ul className="token-list">
          {saferTokens.map((token) => (
            <li key={`safe-${token.id}`}>
              <TokenCard token={token} />
            </li>
          ))}
        </ul>
      </section>

      <section className="monetization-panel">
        <div className="token-section__head">
          <h2 className="token-section__title">Why HiveMind matters</h2>
          <p className="token-section__lede">
            Crypto traders need warnings before momentum turns into damage.
          </p>
        </div>

        <div className="build-goal">
          <h3>Built for faster decisions</h3>
          <p>1) Search coins before you buy.</p>
          <p>2) Read Watcher risk signals before you chase hype.</p>
          <p>3) Upgrade to Pro when you want deeper whale and alert intelligence.</p>
        </div>
      </section>
    </div>
  );
}
