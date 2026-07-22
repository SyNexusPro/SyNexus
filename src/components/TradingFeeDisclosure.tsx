import { Link } from "react-router-dom";
import {
  allocateTradingFeeRevenue,
  calculateTradeFeeUsd,
  formatFeeUsd,
  formatTradingFeeRate,
  type SynexusPlan,
} from "../lib/tradingFees";

type Props = {
  plan: SynexusPlan;
  /** Example trade size for fee estimate (USD notional). */
  notionalUsd?: number;
  /** Show how fee revenue is split across treasury, dev, etc. */
  showAllocation?: boolean;
  /** Compact single-line variant for token cards. */
  compact?: boolean;
  className?: string;
};

export function TradingFeeDisclosure({
  plan,
  notionalUsd = 100,
  showAllocation = false,
  compact = false,
  className = "",
}: Props) {
  const feeRate = formatTradingFeeRate(plan);
  const feeUsd = calculateTradeFeeUsd(notionalUsd, plan);
  const allocation = allocateTradingFeeRevenue(feeUsd);
  const planLabel = plan === "PRO" ? "SyNexusPro" : "Free";

  if (compact) {
    return (
      <p className={`trading-fee-disclosure trading-fee-disclosure--compact ${className}`.trim()} role="note">
        SyNexus fee: <strong>{feeRate}</strong> ({planLabel})
        {plan === "FREE" ? (
          <>
            {" "}
            ·{" "}
            <Link to="/pulse">Upgrade to Pro</Link> for {formatTradingFeeRate("PRO")}
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div className={`trading-fee-disclosure ${className}`.trim()} role="note">
      <div className="trading-fee-disclosure__head">
        <p className="trading-fee-disclosure__eyebrow">SyNexus trading fee</p>
        <p className="trading-fee-disclosure__rate">
          <strong>{feeRate}</strong> per swap · {planLabel}
        </p>
      </div>
      <p className="trading-fee-disclosure__example">
        Example on {formatFeeUsd(notionalUsd)} trade:{" "}
        <strong>{formatFeeUsd(feeUsd)}</strong> SyNexus fee
        {plan === "FREE" ? (
          <>
            {" "}
            — <Link to="/pulse">SyNexusPro</Link> pays {formatTradingFeeRate("PRO")}
          </>
        ) : null}
      </p>
      {showAllocation ? (
        <div className="trading-fee-disclosure__allocation">
          <p className="trading-fee-disclosure__allocation-title">Fee revenue allocation</p>
          <ul className="trading-fee-disclosure__allocation-list">
            {allocation.map((row) => (
              <li key={row.id}>
                <span className="trading-fee-disclosure__allocation-label">{row.label}</span>
                <span className="trading-fee-disclosure__allocation-pct">{row.pct}%</span>
                <span className="trading-fee-disclosure__allocation-bar" aria-hidden>
                  <span style={{ width: `${row.pct}%` }} />
                </span>
                <span className="trading-fee-disclosure__allocation-amt">{formatFeeUsd(row.amountUsd)}</span>
              </li>
            ))}
          </ul>
          <p className="trading-fee-disclosure__fineprint">
            Illustrative split on the example fee above. Actual routing follows treasury policy and on-chain
            configs when fee collection is live.
          </p>
        </div>
      ) : (
        <p className="trading-fee-disclosure__fineprint">
          Fees support liquidity, product development, and security —{" "}
          <Link to="/liquidity-treasury">SyNexus Coin Liquidity Treasury</Link>.
        </p>
      )}
    </div>
  );
}
