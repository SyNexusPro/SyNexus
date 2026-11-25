import { Link } from "react-router-dom";
import { CONNECT_WALLET_PATH } from "../config/connectWallet";
import {
  SYNEXUS_VAULT_PRODUCT_NAME,
  SYNEXUS_VAULT_STATUS,
} from "../config/walletComingSoon";

/** Legacy /wallet-terms route — points people to Connect Wallet for this release. */
export function WalletComingSoon() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{SYNEXUS_VAULT_STATUS}</p>
      <h1 className="legal-page__title">{SYNEXUS_VAULT_PRODUCT_NAME}</h1>
      <p className="legal-page__summary">
        For this public release, connect with WalletConnect. SyNexus does not create custodial wallets and
        never asks for private keys or seed phrases. The built-in SyN Wallet remains preserved for a future release —
        it is not offered in the public app.
      </p>

      <section className="legal-section marketing-panel">
        <h2>What to use today</h2>
        <p>
          Use <Link to={CONNECT_WALLET_PATH}>Connect Wallet</Link> for read-only holdings and risk analysis with Hera.
          Live swaps stay disabled until trading is explicitly approved.
        </p>
        <p>
          <Link to={CONNECT_WALLET_PATH}>Connect Wallet</Link>
          {" · "}
          <Link to="/">← Back to feed</Link>
          {" · "}
          <Link to="/trust">Trust &amp; supported wallets</Link>
        </p>
      </section>
    </div>
  );
}
