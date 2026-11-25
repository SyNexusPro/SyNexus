import { Link } from "react-router-dom";
import { useConnectedWallet } from "../context/ConnectedWalletContext";
import { isWalletConnectConfigured, WALLETCONNECT_WALLET_NAME } from "../lib/walletConnectSolana";

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ConnectWallet() {
  const wallet = useConnectedWallet();
  const wc = wallet.wallets.find((w) => w.kind === WALLETCONNECT_WALLET_NAME);
  const wcReady = Boolean(wc) || isWalletConnectConfigured();

  return (
    <div className="page">
      <section className="page__intro">
        <h1 className="page__headline">Connect Wallet</h1>
        <p className="page__lede">
          Connect with WalletConnect — any compatible Solana wallet. SyNexus never asks for private keys, seed phrases,
          or recovery phrases. This release is read-only analysis — live swaps stay off until you approve trading.
        </p>
      </section>

      <section className="marketing-panel">
        <h2>How it works</h2>
        <p>
          Tap Connect, then approve in your wallet app (QR on desktop, deep link on mobile). Signing stays inside your
          wallet. Security scans are advisory and never guarantee that a token is safe.
        </p>
      </section>

      <section className="marketing-panel">
        <h2>{wallet.address ? "Connected" : "WalletConnect"}</h2>
        {wallet.address ? (
          <>
            <p>
              <strong>{wallet.kind}</strong> · {shortAddress(wallet.address)}
            </p>
            {wallet.snapshot ? (
              <>
                <p>SOL ≈ {wallet.snapshot.sol.toFixed(4)}</p>
                {wallet.snapshot.tokens.length ? (
                  <ul>
                    {wallet.snapshot.tokens.slice(0, 12).map((tok) => (
                      <li key={tok.mint}>
                        {tok.uiAmount.toPrecision(4)} {tok.symbol}{" "}
                        <Link to={`/?scan=${encodeURIComponent(tok.mint)}`}>Scan</Link>
                        {" · "}
                        <Link to={`/token/${encodeURIComponent(tok.mint)}`}>Details</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No SPL token balances above zero.</p>
                )}
              </>
            ) : (
              <p>Loading balances…</p>
            )}
            <p>
              <button type="button" className="pulse-demo-button" disabled={wallet.busy} onClick={() => void wallet.disconnect()}>
                Disconnect
              </button>
              {" "}
              <button type="button" className="pulse-demo-button" disabled={wallet.busy} onClick={() => void wallet.refresh()}>
                Refresh balances
              </button>
            </p>
            <p>
              Ask Hera about this wallet for a plain-English holdings and risk read. Analysis never requires transaction
              signing.
            </p>
          </>
        ) : (
          <>
            <div className="pulse-synexus-pro-promo__cta-wrap">
              {wcReady ? (
                <button
                  type="button"
                  className="pulse-button--pro pulse-synexus-pro-promo__cta"
                  disabled={wallet.busy || !wc}
                  onClick={() => void wallet.connect(WALLETCONNECT_WALLET_NAME)}
                >
                  {wc?.icon ? (
                    <img src={wc.icon} alt="" width={20} height={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  ) : null}
                  Connect with WalletConnect
                </button>
              ) : (
                <p role="status">WalletConnect is not configured yet. Ask the operator to set the project ID.</p>
              )}
            </div>
          </>
        )}
        {wallet.error ? <p role="alert">{wallet.error}</p> : null}
      </section>

      <section className="marketing-panel">
        <h2>What Hera can do with a connected wallet</h2>
        <ul>
          <li>Read the public address you connected</li>
          <li>Show SOL and supported token holdings</li>
          <li>Help analyze holdings and token risk indicators</li>
          <li>Point you to existing Helius / GoPlus-backed scans in SyNexus</li>
        </ul>
        <p>
          <Link to="/">Token scan</Link>
          {" · "}
          <Link to="/trust">Trust &amp; supported wallets</Link>
          {" · "}
          <Link to="/pricing">Membership</Link>
        </p>
      </section>
    </div>
  );
}
