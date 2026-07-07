import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TokenCard } from "../components/TokenCard";
import { TrustIndicators } from "../components/TrustIndicators";
import { NonCustodialDisclaimer } from "../components/NonCustodialDisclaimer";
import { AppScreenshotGallery } from "../components/AppScreenshotGallery";
import { SupportedWallets } from "../components/SupportedWallets";
import { SynexusLiveScanner } from "../components/SynexusLiveScanner";
import { ShouldIBuyPanel } from "../components/ShouldIBuyPanel";
import { TopMoversPanel } from "../components/TopMoversPanel";
import { ProDemoButton } from "../components/ProDemoButton";
import {
  SYNEXUS_PRO_OFFER_SHORT,
  SYNEXUS_PRO_PRICE_LABEL,
} from "../config/proPricing";
import { SYNEXUS_PRO_TRIAL_DAYS } from "../config/proTrial";
import { SynCoinLaunchBanner } from "../components/SynCoinLaunchBanner";
import { BeginnerQuickStart } from "../components/BeginnerQuickStart";
import { SentinelAlertsHub } from "../components/SentinelAlertsHub";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { useOpenTitanGate } from "../hooks/useOpenTitanGate";
import { sampleTokens, type Token } from "../data/tokens";
import { fetchMvpTokenFeed } from "../services/marketDataService";

export function HomeFeed() {
  const { isSimple } = useSynexusUIMode();
  const openTitanGate = useOpenTitanGate();
  const [searchParams] = useSearchParams();
  const scanQuery = searchParams.get("scan")?.trim() ?? "";
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
  const [coinSearch, setCoinSearch] = useState("");

  useEffect(() => {
    setFeedError(null);
    fetchMvpTokenFeed()
      .then((data) => {
        setAllTokens(data.all);
        setTrendingTokens(data.trending);
        setGuardianAlerts(data.alerts);
        setSaferTokens(data.verified);
        setFeedSource(data.source);
        setDexLiveCount(data.dexLiveCount);
      })
      .catch(() => {
        setFeedError("Market data is not available right now. Showing sample tokens.");
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
    <div className={`page${isSimple ? " page--easy" : ""}`}>
      <SynCoinLaunchBanner />
      <section className={`landing-hero${isSimple ? " landing-hero--easy" : ""}`}>
        <div className="landing-hero__inner">
          <div className="landing-hero__masthead">
            <div className="neural-hero-art neural-hero-art--masthead">
              <span className="neural-node neural-node--left" aria-hidden />
              <span className="neural-node neural-node--mid-left" aria-hidden />
              <div className="neural-hero-art__frame">
                <img
                  className="neural-brain-logo neural-brain-logo--art"
                  src="/hivemind-brain.png"
                  alt="Synexus"
                />
                <img
                  className="landing-hero__wordmark"
                  src="/synexus-wordmark.png"
                  alt="Synexus"
                />
              </div>
              <span className="neural-node neural-node--mid-right" aria-hidden />
              <span className="neural-node neural-node--right" aria-hidden />
            </div>
          </div>
          <h1 className="landing-hero__headline">
            {isSimple ? "Should I buy this?" : "AI-powered Solana trading intelligence"}
          </h1>
          <p className="landing-hero__subtext">
            {isSimple
              ? `Paste any token. Get a simple answer in seconds — ${SYNEXUS_PRO_OFFER_SHORT}`
              : "Detect scams, track whales, monitor momentum, and trade smarter."}
          </p>
          <div className="landing-hero__actions">
            {isSimple ? null : (
              <ProDemoButton
                className="landing-hero__actions--demo"
                goToPulse
                pulseHash="#synexus-pro"
              />
            )}
            <Link to="/pulse" className="landing-hero__actions--secondary">
              {isSimple ? "Wallet & tools" : "Sentinel alerts"}
            </Link>
            {!isSimple ? (
              <Link to="/pulse#synexus-pro" className="landing-hero__actions--pro">
                Synexus Pro
              </Link>
            ) : (
              <ProDemoButton
                className="landing-hero__actions--demo"
                goToPulse
                pulseHash="#synexus-pro"
              />
            )}
          </div>
        </div>
      </section>

      {isSimple ? null : (
        <section className="home-trust-strip marketing-panel">
          <TrustIndicators compact />
          <p className="home-trust-strip__links">
            <Link to="/trust">Security &amp; privacy</Link>
            {" · "}
            <Link to="/about">About</Link>
            {" · "}
            <Link to="/contact">Support</Link>
          </p>
        </section>
      )}

      {isSimple ? <BeginnerQuickStart /> : null}

      <ShouldIBuyPanel poolTokens={allTokens} initialScan={scanQuery} />
      <TopMoversPanel />

      {isSimple ? (
        <p className="easy-trust-note">
          Non-custodial — Synexus never holds your keys.{" "}
          <Link to="/trust">How we keep you safe →</Link>
        </p>
      ) : (
        <NonCustodialDisclaimer className="home-non-custodial" />
      )}

      {isSimple ? (
        <>
          <section className="simple-launch-links">
            <Link to="/pulse#wallet-performance" className="simple-launch-links__card">
              <p className="simple-launch-links__eyebrow">Step 3 · Track</p>
              <h2>Wallet dashboard</h2>
              <p>See wins, losses, and habits — your trading stats in one place.</p>
            </Link>
            <button type="button" className="simple-launch-links__card" onClick={openTitanGate}>
              <p className="simple-launch-links__eyebrow">Bonus · Command</p>
              <h2>Titan tools</h2>
              <p>Ask questions and run Sentinels when you&apos;re ready to go deeper.</p>
            </button>
          </section>

          <section className="token-section">
            <div className="token-section__head">
              <h2 className="token-section__title">Popular right now</h2>
              <p className="token-section__lede">Tap any coin to scan it first</p>
            </div>
            <ul className="token-list">
              {trendingTokens.map((token) => (
                <li key={`trend-${token.id}`}>
                  <TokenCard token={token} />
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <>
      <SentinelAlertsHub tokens={allTokens} />

      <section className="landing-info-grid">
        <article className="landing-info-card landing-info-card--spotlight">
          <h2>One flash of intel before the candles catch up.</h2>
          <p>
            The Synexus Sentinels slam liquidity drift, whale-sized moves, violent volume, and swarm reports into a
            single hit—you feel the shift before the feed goes loud.
          </p>
        </article>
        <article className="landing-info-card">
          <h2>Detect risks. Track whales. Flag scams.</h2>
          <p>
            The Synexus routes signals through four Sentinels—Aegis, Pulse, Titan, and Cipher—so you get one
            coherent read instead of noise.
          </p>
        </article>
        <article className="landing-info-card landing-info-card--warning">
          <h2>Bad tokens move fast.</h2>
          <p>
            Scam launches, rug pulls, sudden dumps, and whale exits can hit before most traders see
            the warning. Synexus is built to surface those signals early.
          </p>
        </article>
      </section>

      <SynexusLiveScanner
        tokens={allTokens}
        feedSource={feedSource}
        dexLiveCount={dexLiveCount}
        loading={feedLoading}
        error={feedError}
      />

      <section className="coin-search-panel">
        <h2 className="token-section__title coin-search-panel__title">Token search</h2>
        <input
          id="token-search"
          className="coin-search-panel__input"
          value={coinSearch}
          onChange={(event) => setCoinSearch(event.target.value)}
          placeholder="Name, symbol, or mint"
          aria-label="Search tokens"
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
              No matching tokens in the Synexus feed. Try SOL, SYN, BONK, or PEPE.
            </p>
          )
        ) : null}
      </section>

      <section className="synexus-trade-panel">
        <div className="synexus-trade-panel__body">
          <p className="synexus-trade-panel__eyebrow">Trade on Synexus</p>
          <h2 className="synexus-trade-panel__title">Scan first. Execute when you&apos;re ready.</h2>
          <p className="synexus-trade-panel__copy">
            Sentinel-checked tokens from your feed — open any coin, review the risk read, then buy or sell
            from Synexus. Your wallet only signs; Synexus runs the flow.
          </p>
        </div>
        <p className="synexus-trade-panel__wallet">
          <img className="synexus-trade-panel__wallet-icon" src="/phantom-wallet.svg" alt="" aria-hidden />
          <span>
            Works with Phantom{" "}
            <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer">
              (get wallet)
            </a>
            {" "}and other Solana wallets.
          </span>
        </p>
      </section>

      <section className="hive-vision">
        <div className="hive-vision__head">
          <p className="hive-vision__eyebrow">Synexus Security Grid</p>
          <h2 className="hive-vision__title">Built to be the safest Solana trading command center.</h2>
          <p className="hive-vision__copy">
            AI risk modeling, crowd intelligence, and real-time signals from The Synexus work as one system.
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
              Reports from traders feed into The Synexus scoring so risky tokens are flagged faster.
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
          <p className="token-section__lede">Fast movers across the Synexus feed</p>
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
          <h2 className="token-section__title">Synexus risk alerts</h2>
          <p className="token-section__lede">
            Warning and danger bands that need attention
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
            Tokens currently classified in the Synexus Safe band
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

      <section className="home-screenshots marketing-panel">
        <div className="home-screenshots__head">
          <p className="home-screenshots__eyebrow">Inside Synexus</p>
          <h2 className="home-screenshots__title">Token scanner · Whale tracker · Risk score · Alerts · AI</h2>
          <p className="home-screenshots__copy">
            Preview the core surfaces — export device captures for Google Play when you ship Android.
          </p>
        </div>
        <AppScreenshotGallery />
        <p className="home-screenshots__more">
          <Link to="/about">Full About page →</Link>
        </p>
      </section>

      <section className="home-wallets marketing-panel">
        <h2 className="home-wallets__title">Supported wallets</h2>
        <p className="home-wallets__copy">Connect Phantom, Solflare, Backpack, and other Solana wallets — you sign every swap.</p>
        <SupportedWallets />
      </section>

      <section className="monetization-panel">
        <div className="token-section__head">
          <h2 className="token-section__title">Why Synexus matters</h2>
          <p className="token-section__lede">
            Crypto traders need warnings before momentum turns into damage.
          </p>
        </div>

        <div className="build-goal">
          <h3>Built for faster decisions</h3>
          <p>1) Search coins before you buy.</p>
          <p>2) Read Sentinel risk signals before you chase hype.</p>
          <p>3) Sign up through Titan — {SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial, no card — then {SYNEXUS_PRO_PRICE_LABEL} if you keep it.</p>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
