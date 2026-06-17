import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AFFILIATE_TIERS,
  HIVE_DOMAIN,
  STAKING_FEE_BPS,
  STAKING_STATUS,
  STORAGE_KEYS,
  bpsToLabel,
} from "../config/ecosystem";
import {
  TRADING_FEE_BPS,
  TRADING_FEE_REVENUE_ALLOCATION,
} from "../config/tradingFees";
import { formatTradingFeeRate } from "../lib/tradingFees";
import { SYN_IS_LIVE, SYN_PUMPFUN_URL, SYN_SYMBOL, SYN_TOKEN_ID } from "../config/synToken";

export function EcosystemHub() {
  const [params] = useSearchParams();
  const intent = params.get("intent");
  const symbol = params.get("symbol");
  const [affiliateHandle, setAffiliateHandle] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEYS.affiliateHandle) ?? "" : "",
  );
  const [payoutHintOpen, setPayoutHintOpen] = useState(false);

  const payoutPortalUrl = (import.meta.env.VITE_AFFILIATE_PAYOUT_URL ?? "").trim() || undefined;

  const referralPreview = useMemo(() => {
    const handle = affiliateHandle.trim().replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (!handle) return `${HIVE_DOMAIN}/?ref=your-handle`;
    return `${HIVE_DOMAIN}/?ref=${encodeURIComponent(handle)}`;
  }, [affiliateHandle]);

  useEffect(() => {
    if (intent === "stake" || symbol) {
      const el = document.getElementById("hub-staking");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (typeof window !== "undefined" && window.location.hash === "#hub-trading-fees") {
      document.getElementById("hub-trading-fees")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [intent, symbol]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.affiliateHandle, affiliateHandle);
  }, [affiliateHandle]);

  return (
    <div className="page ecosystem-hub">
      <section className="ecosystem-hub__hero marketing-panel">
        <p className="ecosystem-hub__eyebrow">Synexus ecosystem</p>
        <h1 className="ecosystem-hub__title">Content hub · Affiliates · Token utility · Staking</h1>
        <p className="ecosystem-hub__lede">
          One home for market discovery, partner growth, and planned on-chain staking with transparent protocol
          fees—always subject to wallet connection, program audits, and your own research.
        </p>
      </section>

      <nav className="ecosystem-hub__subnav" aria-label="Ecosystem sections">
        <a href="#hub-content">Content hub</a>
        <a href="#hub-affiliate">Affiliates</a>
        <a href="#hub-utility">Token utility</a>
        <a href="#hub-trading-fees">Trading fees</a>
        <a href="#hub-staking">Staking &amp; fees</a>
      </nav>

      {symbol ? (
        <p className="ecosystem-hub__context" role="status">
          Staking interest: <strong>{symbol}</strong> — fee model below applies once the staking program is live.
        </p>
      ) : null}

      <section id="hub-content" className="ecosystem-hub__section marketing-panel">
        <h2>Content hub</h2>
        <p>
          Centralize discovery with The Synexus: live token feed, search, risk snapshots, and Pulse for accounts and
          Synexus Pro.
        </p>
        <ul className="ecosystem-hub__links">
          <li>
            <Link to="/">Token feed &amp; search</Link>
          </li>
          <li>
            <Link to="/pulse">Pulse · accounts &amp; Synexus Pro</Link>
          </li>
        </ul>
      </section>

      <section id="hub-affiliate" className="ecosystem-hub__section marketing-panel">
        <h2>Affiliate ecosystem</h2>
        <p>
          Share Synexus with your audience. Final commission rules, cookie windows, and payout rails ship with the
          affiliate program launch. Example tiers below are illustrative only.
        </p>
        <div className="ecosystem-hub__tiers">
          {AFFILIATE_TIERS.map((row) => (
            <article key={row.tier} className="ecosystem-hub__tier-card">
              <p className="ecosystem-hub__tier-name">{row.tier}</p>
              <p className="ecosystem-hub__tier-vol">Qualified volume (example)</p>
              <p className="ecosystem-hub__tier-value">{row.qualifiedVolumeUsd}</p>
              <p className="ecosystem-hub__tier-vol">Example rev share on program subscription events</p>
              <p className="ecosystem-hub__tier-pct">{row.exampleRevSharePct}</p>
            </article>
          ))}
        </div>
        <label className="ecosystem-hub__label" htmlFor="affiliate-handle">
          Your referral handle (saved on this device)
        </label>
        <input
          id="affiliate-handle"
          className="ecosystem-hub__input"
          value={affiliateHandle}
          onChange={(e) => setAffiliateHandle(e.target.value)}
          placeholder="e.g. cryptosara"
          autoComplete="off"
        />
        <p className="ecosystem-hub__ref-url">
          <span>Preview link</span>
          <code>{referralPreview}</code>
        </p>
        <div className="ecosystem-hub__payout-row">
          {payoutPortalUrl ? (
            <a
              className="ecosystem-hub__payout"
              href={payoutPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Affiliate payout dashboard
            </a>
          ) : (
            <button
              type="button"
              className="ecosystem-hub__payout ecosystem-hub__payout--pending"
              onClick={() => setPayoutHintOpen((open) => !open)}
            >
              Affiliate payout dashboard
            </button>
          )}
          {payoutHintOpen && !payoutPortalUrl ? (
            <p className="ecosystem-hub__payout-hint" role="status">
              Payout withdrawals open when the affiliate program goes live. Your referral handle is saved on this
              device; we’ll route you to a secure portal as soon as commissions are enabled.
            </p>
          ) : null}
        </div>
        <p className="ecosystem-hub__fineprint">
          Affiliates must disclose material connections (FTC / platform rules). No guaranteed income. Payouts only on
          qualified actions per program terms.
        </p>
      </section>

      <section id="hub-utility" className="ecosystem-hub__section marketing-panel">
        <h2>Token utility platform</h2>
        {SYN_IS_LIVE ? (
          <p className="ecosystem-hub__syn-live">
            <strong>${SYN_SYMBOL}</strong> community is live on pump.fun — scan it in Synexus before you buy, then trade in
            your own wallet.
          </p>
        ) : null}
        <p>
          Synexus token utility is designed around access, incentives, and alignment: unlock deeper feeds from
          The Synexus Sentinels,
          fee discounts, partner campaigns, and staking participation. See the About page for the full utility
          roadmap.
        </p>
        <ul className="ecosystem-hub__bullets">
          <li>Synexus Pro intelligence surfaces in-app</li>
          <li>Partnership tooling via this hub</li>
          <li>Governance placeholders as the community matures</li>
        </ul>
        {SYN_IS_LIVE ? (
          <div className="ecosystem-hub__syn-actions">
            <a
              className="ecosystem-hub__syn-cta"
              href={SYN_PUMPFUN_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open $SyN community
            </a>
            <Link className="ecosystem-hub__link" to={`/token/${SYN_TOKEN_ID}`}>
              Scan {SYN_SYMBOL} →
            </Link>
          </div>
        ) : null}
      </section>

      <section id="hub-trading-fees" className="ecosystem-hub__section marketing-panel ecosystem-hub__section--trading">
        <h2>Trading fees</h2>
        <p>
          Synexus charges a transparent platform fee on swaps routed through our Jupiter integration. Free accounts
          pay the standard rate; Synexus Pro subscribers receive a reduced fee tier. Fees are separate from
          network gas, DEX spread, and Jupiter&apos;s own routing costs.
        </p>
        <div className="ecosystem-hub__fee-grid ecosystem-hub__fee-grid--two">
          <article>
            <p className="ecosystem-hub__fee-label">Free tier</p>
            <p className="ecosystem-hub__fee-value">{formatTradingFeeRate("FREE")}</p>
            <p className="ecosystem-hub__fee-note">{bpsToLabel(TRADING_FEE_BPS.FREE)} per swap notional</p>
          </article>
          <article>
            <p className="ecosystem-hub__fee-label">Synexus Pro</p>
            <p className="ecosystem-hub__fee-value">{formatTradingFeeRate("PRO")}</p>
            <p className="ecosystem-hub__fee-note">{bpsToLabel(TRADING_FEE_BPS.PRO)} per swap notional</p>
          </article>
        </div>
        <h3 className="ecosystem-hub__subhead">Fee revenue allocation</h3>
        <p>
          Trading-fee revenue is allocated across treasury, operations, and resilience — not 100% to liquidity.
        </p>
        <ul className="ecosystem-hub__allocation">
          {TRADING_FEE_REVENUE_ALLOCATION.map((row) => (
            <li key={row.id}>
              <span className="ecosystem-hub__allocation-label">{row.label}</span>
              <span className="ecosystem-hub__allocation-bar" aria-hidden>
                <span style={{ width: `${row.pct}%` }} />
              </span>
              <span className="ecosystem-hub__allocation-pct">{row.pct}%</span>
            </li>
          ))}
        </ul>
        <p className="ecosystem-hub__fineprint">
          Final on-chain fee collection requires a configured Jupiter fee account (
          <code>VITE_JUPITER_FEE_ACCOUNT</code>) and audited treasury routing. Rates and allocation may be updated
          with notice before mainnet collection goes live.
        </p>
        <Link className="ecosystem-hub__wallet-terms" to="/pulse">
          Upgrade to Synexus Pro
        </Link>
      </section>

      <section id="hub-staking" className="ecosystem-hub__section marketing-panel ecosystem-hub__section--stakes">
        <h2>Staking &amp; protocol fees</h2>
        <p>
          Planned staking pools let users lock eligible assets to support Synexus liquidity or emissions programs while
          the protocol collects transparent fees—not financial advice; smart-contract risk applies.
        </p>
        <p className="ecosystem-hub__status">
          Program status:{" "}
          <strong>{STAKING_STATUS === "planned" ? "Planned — wallet + program rollout" : "Live"}</strong>
        </p>
        <div className="ecosystem-hub__fee-grid">
          <article>
            <p className="ecosystem-hub__fee-label">Deposit fee</p>
            <p className="ecosystem-hub__fee-value">{bpsToLabel(STAKING_FEE_BPS.deposit)}</p>
          </article>
          <article>
            <p className="ecosystem-hub__fee-label">Withdrawal fee</p>
            <p className="ecosystem-hub__fee-value">{bpsToLabel(STAKING_FEE_BPS.withdrawal)}</p>
          </article>
          <article>
            <p className="ecosystem-hub__fee-label">Protocol share of staking rewards</p>
            <p className="ecosystem-hub__fee-value">{bpsToLabel(STAKING_FEE_BPS.rewardsProtocol)}</p>
          </article>
        </div>
        <p className="ecosystem-hub__fineprint">
          Fees shown are configurable design targets for the staking program minted on Solana—the final schedule will appear
          in on-chain configs and audited program docs before money moves.
        </p>
        <div className="ecosystem-hub__wallet-actions">
          <a
            className="ecosystem-hub__phantom"
            href="https://phantom.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Phantom Wallet
          </a>
          <Link className="ecosystem-hub__wallet-terms" to="/terms">
            Read Terms of Service
          </Link>
        </div>
      </section>
    </div>
  );
}
