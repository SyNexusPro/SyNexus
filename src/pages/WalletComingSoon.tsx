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
        A self-custodial Solana wallet with Sentinel scan-before-sign built in — same SyNexus intelligence,
        keys that never leave your device. We&apos;re holding Vault on the back burner while we upgrade the
        Sentinels and Titan AI first.
      </p>

      <section className="legal-section marketing-panel">
        <h2>What to use today</h2>
        <p>
          Connect Phantom, Solflare, or Backpack for swaps via Jupiter shortcuts. Run{" "}
          <strong>Should I buy this?</strong> on the home feed before you sign anything in your wallet app.
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
        Draft wallet terms and architecture live in the repo under <code>future/synexus-vault/</code> — not
        linked from production until launch.
      </p>
    </div>
  );
}
