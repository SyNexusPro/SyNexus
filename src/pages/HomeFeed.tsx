import { useEffect, useState } from "react";
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

  useEffect(() => {
    setFeedError(null);
    setWatcherIdle(getWatcherIdleMessage(Date.now()));
    fetchMvpTokenFeed()
      .then((data) => {
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

  return (
    <div className="page">
      <section className="landing-hero">
        <p className="landing-hero__eyebrow">HiveMind</p>
        <h1 className="landing-hero__headline">
          Find safer tokens. Spot red flags faster.
        </h1>
        <p className="landing-hero__subtext">
          HiveMind scans market activity, liquidity changes, and risk signals so
          traders can move smarter.
        </p>
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
          <h2 className="token-section__title">Current build goal</h2>
          <p className="token-section__lede">
            Make the app look real and make the Guardian feature believable.
          </p>
        </div>

        <div className="build-goal">
          <h3>Next 3 practical tasks</h3>
          <p>1) Polish homepage text and branding</p>
          <p>2) Make Pulse show warnings, safe calls, and alerts</p>
          <p>3) Hook DexScreener data into the feed cleanly</p>
        </div>
      </section>
    </div>
  );
}
