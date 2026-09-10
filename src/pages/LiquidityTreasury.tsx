import { Link } from "react-router-dom";
import { bpsToLabel } from "../config/ecosystem";
import { TRADING_FEE_BPS, TRADING_FEE_REVENUE_ALLOCATION } from "../config/tradingFees";
import {
  allocateTradingFeeRevenue,
  calculateTradeFeeUsd,
  formatFeeUsd,
  formatTradingFeeRate,
} from "../lib/tradingFees";

const EXAMPLE_NOTIONAL_USD = 100;

export function LiquidityTreasury() {
  const freeFee = calculateTradeFeeUsd(EXAMPLE_NOTIONAL_USD, "FREE");
  const proFee = calculateTradeFeeUsd(EXAMPLE_NOTIONAL_USD, "PRO");
  const allocation = allocateTradingFeeRevenue(freeFee);

  return (
    <div className="page legal-page treasury-page">
      <p className="legal-page__eyebrow">Transparency · SyNexus ecosystem</p>
      <h1 className="legal-page__title">SyNexus Coin Liquidity Treasury</h1>
      <p className="legal-page__summary">
        When you swap through SyNexus shortcuts (for example, Jupiter links with platform fees enabled), a small
        platform fee may apply. This page shows where that revenue goes — mostly back into SyNexus coin liquidity and
        treasury, plus development, security, and resilience.
      </p>

      <p className="legal-page__summary legal-page__summary--compact">
        See also: <Link to="/terms">Terms of Service</Link>
        {" · "}
        <Link to="/privacy">Privacy Policy</Link>
        {" · "}
        <Link to="/hub">Ecosystem hub</Link>
      </p>

      <section className="legal-section marketing-panel">
        <h2>Platform fee tiers</h2>
        <p>
          Fees are calculated on swap notional value and are separate from network gas, DEX spread, slippage, and
          Jupiter routing costs. SyNexusPro subscribers pay a reduced rate.
        </p>
        <div className="ecosystem-hub__fee-grid ecosystem-hub__fee-grid--two">
          <article>
            <p className="ecosystem-hub__fee-label">Free tier</p>
            <p className="ecosystem-hub__fee-value">{formatTradingFeeRate("FREE")}</p>
            <p className="ecosystem-hub__fee-note">{bpsToLabel(TRADING_FEE_BPS.FREE)} per swap notional</p>
          </article>
          <article>
            <p className="ecosystem-hub__fee-label">SyNexusPro</p>
            <p className="ecosystem-hub__fee-value">{formatTradingFeeRate("PRO")}</p>
            <p className="ecosystem-hub__fee-note">{bpsToLabel(TRADING_FEE_BPS.PRO)} per swap notional</p>
          </article>
        </div>
        <p>
          Example on {formatFeeUsd(EXAMPLE_NOTIONAL_USD)} swap:{" "}
          <strong>{formatFeeUsd(freeFee)}</strong> (free) or{" "}
          <strong>{formatFeeUsd(proFee)}</strong> (Pro).{" "}
          <Link to="/pulse">Upgrade to SyNexusPro</Link> for the lower tier.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Where the money goes</h2>
        <p>
          Trading-fee revenue is allocated across treasury, operations, and resilience — not 100% to a single bucket.
          The largest share supports SyNexus coin liquidity and treasury.
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
          Illustrative split on a {formatFeeUsd(freeFee)} free-tier fee ({formatFeeUsd(EXAMPLE_NOTIONAL_USD)} swap):
        </p>
        <ul className="treasury-page__slice-list">
          {allocation.map((row) => (
            <li key={row.id}>
              <span>{row.label}</span>
              <span>
                {row.pct}% · {formatFeeUsd(row.amountUsd)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="legal-section marketing-panel">
        <h2>On-chain collection</h2>
        <p>
          Final on-chain fee collection requires a configured Jupiter fee account (
          <code>VITE_JUPITER_FEE_ACCOUNT</code>) and audited treasury routing. Rates and allocation may be updated
          with notice before mainnet collection goes live. We do not guarantee that every trade path will collect fees
          until integration is fully live.
        </p>
      </section>

      <p className="legal-page__note">
        This is a transparency page for traders who want to see how platform fees support the SyNexus ecosystem. It is
        not financial advice. Fee details also appear in our{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>

      <p className="legal-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/terms">Terms</Link>
        {" · "}
        <Link to="/privacy">Privacy</Link>
      </p>
    </div>
  );
}
