import { useState } from "react";

const PLAN_STORAGE_KEY = "hivemind_paid_plan";
const BANNER_DISMISS_KEY = "hivemind_pro_banner_dismissed";

function isSynexusProPlan(): boolean {
  try {
    return localStorage.getItem(PLAN_STORAGE_KEY) === "PRO";
  } catch {
    return false;
  }
}

function isBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function ProTrialBanner() {
  const [hidden, setHidden] = useState(() => isSynexusProPlan() || isBannerDismissed());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function startTrial() {
    if (busy) return;
    setError(false);
    try {
      setBusy(true);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string };
      if (!response.ok || !data.url) throw new Error("checkout failed");
      window.location.href = data.url;
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="pro-trial-banner" role="region" aria-label="Synexus Pro trial offer">
      <div className="pro-trial-banner__text">
        <span className="pro-trial-banner__headline">First month free</span>
        <span className="pro-trial-banner__detail">
          {error ? "Checkout couldn't open. Tap to retry." : "Synexus Pro · $19.99/mo after trial · cancel anytime"}
        </span>
      </div>
      <button
        type="button"
        className="pro-trial-banner__cta"
        disabled={busy}
        onClick={() => void startTrial()}
      >
        {busy ? "Opening…" : "Start trial"}
      </button>
      <button type="button" className="pro-trial-banner__close" onClick={dismiss} aria-label="Dismiss offer">
        ×
      </button>
    </div>
  );
}
