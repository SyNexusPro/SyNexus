import { useState } from "react";
import { Link } from "react-router-dom";
import {
  SYN_IS_LIVE,
  SYN_PUMPFUN_URL,
  SYN_SYMBOL,
  SYN_TOKEN_ID,
  dismissSynLaunchBanner,
  isSynLaunchBannerDismissed,
} from "../config/synToken";

export function SynCoinLaunchBanner() {
  const [hidden, setHidden] = useState(() => !SYN_IS_LIVE || isSynLaunchBannerDismissed());

  if (hidden) return null;

  function close() {
    dismissSynLaunchBanner();
    setHidden(true);
  }

  return (
    <section className="syn-launch-banner" role="region" aria-label="SYN token is live">
      <div className="syn-launch-banner__glow" aria-hidden />
      <div className="syn-launch-banner__text">
        <p className="syn-launch-banner__eyebrow">Now live</p>
        <p className="syn-launch-banner__headline">
          <strong>${SYN_SYMBOL}</strong> community token is live on Solana
        </p>
        <p className="syn-launch-banner__detail">
          Buy ${SYN_SYMBOL} on pump.fun — scan the mint in-app first, then trade in your wallet.
        </p>
      </div>
      <div className="syn-launch-banner__actions">
        <a
          className="syn-launch-banner__cta"
          href={SYN_PUMPFUN_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Buy ${SYN_SYMBOL} on pump.fun
        </a>
        <Link className="syn-launch-banner__secondary" to={`/token/${SYN_TOKEN_ID}`}>
          Scan {SYN_SYMBOL}
        </Link>
        <button type="button" className="syn-launch-banner__close" onClick={close} aria-label="Dismiss">
          ×
        </button>
      </div>
    </section>
  );
}
