import { WalletHealthDashboard } from "./WalletHealthDashboard";
import { TradeJournalPanel } from "./TradeJournalPanel";

export function WalletPerformanceDashboard() {
  return (
    <div className="wallet-performance" id="wallet-performance">
      <div className="wallet-performance__head">
        <p className="wallet-performance__eyebrow">Your stats</p>
        <h2 className="wallet-performance__title">Wallet performance</h2>
        <p className="wallet-performance__lede">
          Auto-tracked entries, exits, profit and loss, plus habits and suggestions to improve.
        </p>
      </div>
      <WalletHealthDashboard embedded />
      <TradeJournalPanel embedded />
    </div>
  );
}
