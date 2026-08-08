import { Link } from "react-router-dom";
import {
  SYNEXUS_VAULT_PRODUCT_NAME,
  SYNEXUS_VAULT_STATUS,
} from "../config/walletComingSoon";

export function WalletComingSoon() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{SYNEXUS_VAULT_STATUS}</p>
      <h1 className="legal-page__title">{SYNEXUS_VAULT_PRODUCT_NAME}</h1>
      <p className="legal-page__summary">
        Self-custodial Solana wallet with Sentinel Helix on watch — keys that never leave your device.
        Wallet UI is on hold while we harden Helix and the rest of the Sentinel grid.
      </p>

      <section className="legal-section marketing-panel">
        <h2>What to use today</h2>
        <p>
          Connect Phantom, Solflare, or Backpack for swaps via Jupiter shortcuts. Run{" "}
          <strong>token scan</strong> on the home feed before you sign anything in your wallet app.
        </p>
        <p>
          <Link to="/">← Back to feed</Link>
          {" · "}
          <Link to="/trust">Trust &amp; supported wallets</Link>
          {" · "}
          <Link to="/pulse">Pulse</Link>
        </p>
      </section>

      <p className="legal-page__note">
        Implementation parked under <code>future/syn-wallet/</code>. Sentinel Helix is already live in the
        grid — ask Titan about him anytime.
      </p>
    </div>
  );
}
