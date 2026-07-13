import { useState } from "react";
import { Link } from "react-router-dom";
import { SYNEXUS_PRO_PRICE_SHORT } from "../config/proPricing";
import { SYNEXUS_PRO_TRIAL_LABEL } from "../config/proTrial";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import { getCurrentUser } from "../lib/supabaseData";
import { redirectToProCheckout, startProCheckout } from "../lib/squareCheckout";
import { useProDemo } from "../hooks/useProDemo";

export function ProDemoBanner() {
  const { active, remainingLabel } = useProDemo();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);

  if (!active) return null;

  async function subscribe() {
    if (checkoutBusy) return;
    setCheckoutError(false);
    try {
      setCheckoutBusy(true);
      const user = await getCurrentUser().catch(() => null);
      const checkout = await startProCheckout({
        userId: user?.id,
        email: user?.email,
      });
      if (!checkout.ok) throw new Error(checkout.error);
      redirectToProCheckout(checkout.url);
    } catch {
      setCheckoutError(true);
      setCheckoutBusy(false);
    }
  }

  return (
    <div className="pro-demo-banner" role="status" aria-live="polite">
      <div className="pro-demo-banner__text">
        <strong>{SYNEXUS_PRO_TRIAL_LABEL} active</strong>
        <span>
          {remainingLabel} — {DEFAULT_TITAN_BOT_NAME}, Sentinels, and full Pulse unlocked.
          {checkoutError ? " Checkout couldn't open — tap Subscribe to retry." : " Add a card before trial ends to keep Pro access."}
        </span>
      </div>
      <div className="pro-demo-banner__actions">
        <button type="button" className="pro-demo-banner__cta" disabled={checkoutBusy} onClick={() => void subscribe()}>
          {checkoutBusy ? "Opening…" : `Subscribe ${SYNEXUS_PRO_PRICE_SHORT}`}
        </button>
        <Link className="pro-demo-banner__link" to="/pulse">
          Open Pulse
        </Link>
      </div>
    </div>
  );
}
