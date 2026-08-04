import { useMemo, useState, useEffect, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TokenCard } from "../components/TokenCard";
import { NonCustodialDisclaimer } from "../components/NonCustodialDisclaimer";
import { SynexusLiveScanner } from "../components/SynexusLiveScanner";
import { ShouldIBuyPanel } from "../components/ShouldIBuyPanel";
import { TopMoversPanel } from "../components/TopMoversPanel";
import { CircuitBoardBackdrop } from "../components/CircuitBoardBackdrop";
import { SynCoinLaunchBanner } from "../components/SynCoinLaunchBanner";
import { BeginnerQuickStart } from "../components/BeginnerQuickStart";
import { SentinelAlertsHub } from "../components/SentinelAlertsHub";
import { HomeEducationalHub } from "../components/HomeEducationalHub";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";
import { useAppIsActive } from "../hooks/useAppIsActive";
import { useOracleMarketFeed } from "../lib/useOracleMarketFeed";
import { isNativeAndroid } from "../lib/bootExperience";
import { sampleTokens } from "../data/tokens";

type FeatureCard = {
  id: string;
  title: string;
  body: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
};

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <span className="home-feature-card__icon" aria-hidden>
      {children}
    </span>
  );
}

export function HomeFeed() {
  const { isSimple } = useSynexusUIMode();
  const openTitanChat = useOpenTitanChat();
  const appActive = useAppIsActive();
  const [searchParams] = useSearchParams();
  const scanQuery = searchParams.get("scan")?.trim() ?? "";
  const { tokens: feedTokens, feedSource, loading: feedLoading } = useOracleMarketFeed({
    enabled: appActive,
    intervalMs: 90_000,
  });
  const allTokens = feedTokens.length ? feedTokens : sampleTokens;
  const trendingTokens = useMemo(
    () =>
      allTokens
        .slice()
        .sort((a, b) => b.change24hPct - a.change24hPct)
        .slice(0, 3),
    [allTokens],
  );
  const guardianAlerts = useMemo(
    () => allTokens.filter((token) => token.guardianRisk !== "SAFE"),
    [allTokens],
  );
  const saferTokens = useMemo(
    () => allTokens.filter((token) => token.guardianRisk === "SAFE"),
    [allTokens],
  );
  const dexLiveCount = feedSource === "live" ? allTokens.length : 0;
  const [feedError, setFeedError] = useState<string | null>(null);
  const [coinSearch, setCoinSearch] = useState("");

  useEffect(() => {
    if (!feedLoading && !feedTokens.length) {
      setFeedError("Market data is not available right now. Showing sample tokens.");
    } else {
      setFeedError(null);
    }
  }, [feedLoading, feedTokens.length]);

  const searchedTokens = useMemo(() => {
    const query = coinSearch.trim().toLowerCase();
    if (!query) return [];

    return allTokens.filter((token) =>
      [token.name, token.symbol, token.mintAddress ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [allTokens, coinSearch]);

  const featureCards: FeatureCard[] = [
    {
      id: "markets",
      title: "Markets",
      body: "Crypto, Stocks, Forex & Market Intelligence.",
      to: "/markets",
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 19V5M4 19h16" />
            <path d="M8 16V10M12 16V7M16 16v-4" />
          </svg>
        </FeatureIcon>
      ),
    },
    {
      id: "ai",
      title: "AI Assistant",
      body: "Your personal AI for anything.",
      onClick: openTitanChat,
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="8" width="14" height="10" rx="3" />
            <circle cx="9.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="14.5" cy="13" r="1.1" fill="currentColor" stroke="none" />
            <path d="M12 4v2M9 18v2M15 18v2" />
          </svg>
        </FeatureIcon>
      ),
    },
    {
      id: "cyber",
      title: "Cybersecurity",
      body: "Threat detection, scans & protection.",
      to: "/trust",
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
            <circle cx="12" cy="12" r="2.2" />
          </svg>
        </FeatureIcon>
      ),
    },
    {
      id: "news",
      title: "News Intelligence",
      body: "Real-time news, insights & event impact.",
      to: "/news",
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="8" />
            <path d="M4 12h16M12 4c2.5 2.5 3.5 5.5 3.5 8S14.5 17.5 12 20M12 4c-2.5 2.5-3.5 5.5-3.5 8S9.5 17.5 12 20" />
          </svg>
        </FeatureIcon>
      ),
    },
    {
      id: "business",
      title: "Business Tools",
      body: "Analyze, optimize & grow your business.",
      to: "/business",
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="4" y="8" width="16" height="11" rx="1.5" />
            <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </FeatureIcon>
      ),
    },
    {
      id: "automations",
      title: "Automations",
      body: "Build AI workflows that work for you.",
      to: "/automations",
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2.5M12 18.5V21M4.9 6.1l1.8 1.8M17.3 16.1l1.8 1.8M3 12h2.5M18.5 12H21M4.9 17.9l1.8-1.8M17.3 7.9l1.8-1.8" />
          </svg>
        </FeatureIcon>
      ),
    },
    {
      id: "learning",
      title: "Learning Hub",
      body: "Learn, upskill & grow with AI tutors.",
      to: "/learn",
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 9l9-4 9 4-9 4-9-4z" />
            <path d="M7 11.5v4.2c0 .6 2.2 2.3 5 2.3s5-1.7 5-2.3v-4.2" />
            <path d="M21 9v6" />
          </svg>
        </FeatureIcon>
      ),
    },
    {
      id: "watchlist",
      title: "Watchlist",
      body: "Track what matters most to you.",
      to: "/watchlist",
      icon: (
        <FeatureIcon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8l-4.8 2.6.9-5.4-3.9-3.8 5.4-.8L12 3.5z" />
          </svg>
        </FeatureIcon>
      ),
    },
  ];

  return (
    <div className={`page page--command${isSimple ? " page--easy" : ""}`}>
      <CircuitBoardBackdrop alive={!isNativeAndroid()} />

      <section className="home-command" aria-label="SyNexus home">
        <div className="home-command__brand">
          <img
            className="home-command__mark"
            src="/synexus-brand-mark.png"
            alt="SyNexus"
            draggable={false}
          />
          <h1 className="home-command__headline">One AI. Unlimited Intelligence.</h1>
          <p className="home-command__lede">
            Markets. Business. Security. Automation. All Connected.
          </p>
        </div>

        <div className="home-feature-grid" role="list">
          {featureCards.map((card) => {
            const inner = (
              <>
                {card.icon}
                <span className="home-feature-card__title">{card.title}</span>
                <span className="home-feature-card__body">{card.body}</span>
              </>
            );

            if (card.onClick) {
              return (
                <button
                  key={card.id}
                  type="button"
                  className="home-feature-card"
                  role="listitem"
                  onClick={card.onClick}
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={card.id}
                className="home-feature-card"
                role="listitem"
                to={card.to ?? "/"}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="home-command-tools">
        <SynCoinLaunchBanner />
        {isSimple ? <BeginnerQuickStart /> : null}

        <section id="scan" className="home-command-tools__scan">
          <ShouldIBuyPanel poolTokens={allTokens} initialScan={scanQuery} />
          <TopMoversPanel />
        </section>

        {isSimple ? (
          <>
            <section className="simple-launch-links">
              <Link to="/pulse#wallet-performance" className="simple-launch-links__card">
                <p className="simple-launch-links__eyebrow">Step 3 · Track</p>
                <h2>Wallet dashboard</h2>
                <p>See wins, losses, and habits — your trading stats in one place.</p>
              </Link>
              <button type="button" className="simple-launch-links__card" onClick={openTitanChat}>
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

            <HomeEducationalHub />
          </>
        ) : (
          <>
            <SentinelAlertsHub tokens={allTokens} />

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
                    No matching tokens in the SyNexus feed. Try SOL, SYN, BONK, or PEPE.
                  </p>
                )
              ) : null}
            </section>

            <section className="token-section">
              <div className="token-section__head">
                <h2 className="token-section__title">Trending Tokens</h2>
                <p className="token-section__lede">Fast movers across the SyNexus feed</p>
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
                <h2 className="token-section__title">SyNexus risk alerts</h2>
                <p className="token-section__lede">Warning and danger bands that need attention</p>
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
                <p className="token-section__lede">Tokens currently classified in the SyNexus Safe band</p>
              </div>
              <ul className="token-list">
                {saferTokens.map((token) => (
                  <li key={`safe-${token.id}`}>
                    <TokenCard token={token} />
                  </li>
                ))}
              </ul>
            </section>

            <HomeEducationalHub />
          </>
        )}

        {isSimple ? (
          <p className="easy-trust-note">
            Non-custodial — SyNexus never holds your keys.{" "}
            <Link to="/trust">How we keep you safe →</Link>
          </p>
        ) : (
          <NonCustodialDisclaimer className="home-non-custodial" />
        )}
      </div>
    </div>
  );
}
