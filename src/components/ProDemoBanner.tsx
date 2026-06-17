import { useState } from "react";
import { Link } from "react-router-dom";
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
        <strong>Pro demo active</strong>
        <span>
          {remainingLabel} left — Oracle, Sentinels, and full Pulse unlocked. Subscribe to keep access.
        </span>
      </div>
      <div className="pro-demo-banner__actions">
        <button type="button" className="pro-demo-banner__cta" disabled={checkoutBusy} onClick={() => void subscribe()}>
          {checkoutBusy ? "Opening…" : "Subscribe $19.99/mo"}
        </button>
        <Link className="pro-demo-banner__link" to="/pulse">
          Open Pulse
        </Link>
      </div>
    </div>
  );
}
