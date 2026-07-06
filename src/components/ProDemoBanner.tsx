import { useState } from "react";
import { Link } from "react-router-dom";
import { SYNEXUS_PRO_PRICE_SHORT } from "../config/proPricing";
import { SYNEXUS_PRO_TRIAL_LABEL } from "../config/proTrial";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import { useProDemo } from "../hooks/useProDemo";

export function ProDemoBanner() {
  const { active, remainingLabel } = useProDemo();
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  if (!active) return null;

  async function subscribe() {
    if (checkoutBusy) return;
    try {
      setCheckoutBusy(true);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string };
      if (!response.ok || !data.url) throw new Error("checkout failed");
      window.location.href = data.url;
    } catch {
      setCheckoutBusy(false);
    }
  }

  return (
    <div className="pro-demo-banner" role="status" aria-live="polite">
      <div className="pro-demo-banner__text">
        <strong>{SYNEXUS_PRO_TRIAL_LABEL} active</strong>
        <span>
          {remainingLabel} — {DEFAULT_TITAN_BOT_NAME}, Sentinels, and full Pulse unlocked. No card was required for your trial.
          Subscribe to keep access after it ends.
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
