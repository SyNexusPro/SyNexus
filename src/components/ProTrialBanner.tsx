import { useState } from "react";
import { SYNEXUS_PRO_TRIAL_DAYS, SYNEXUS_PRO_TRIAL_LABEL } from "../config/proTrial";
import { SYNEXUS_PRO_PRICE_LABEL } from "../config/proPricing";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";
import { isProTrialActive } from "../lib/proDemo";
import { openOracleLogin } from "../lib/openOracleLogin";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { ProDemoButton } from "./ProDemoButton";

const PLAN_STORAGE_KEY = "hivemind_paid_plan";
const BANNER_DISMISS_KEY = "hivemind_pro_banner_dismissed";

function isSynexusProPlan(): boolean {
  try {
    return (
      (localStorage.getItem(PLAN_STORAGE_KEY) === "PRO" && !isProTrialActive()) ||
      hasStoredOwnerGrant()
    );
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
  const { linked } = useOperatorAuth();
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

  async function startCheckout() {
    if (busy) return;
    if (!linked) {
      openOracleLogin();
      return;
    }
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

  const detail = !linked
    ? `${SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial after sign-up · no card required · then ${SYNEXUS_PRO_PRICE_LABEL}`
    : error
      ? "Checkout couldn't open. Tap to retry."
      : `${SYNEXUS_PRO_TRIAL_LABEL} active or available · ${SYNEXUS_PRO_PRICE_LABEL} after trial · cancel anytime`;

  return (
    <div className="pro-trial-banner" role="region" aria-label="Synexus Pro subscription">
      <div className="pro-trial-banner__text">
        <span className="pro-trial-banner__headline">Synexus Pro</span>
        <span className="pro-trial-banner__detail">{detail}</span>
      </div>
      <ProDemoButton
        className="pro-trial-banner__demo"
        label={linked ? `Open ${SYNEXUS_PRO_TRIAL_LABEL}` : "Enter Oracle · sign up free"}
      />
      {linked ? (
        <button
          type="button"
          className="pro-trial-banner__cta"
          disabled={busy}
          onClick={() => void startCheckout()}
        >
          {busy ? "Opening…" : "Subscribe"}
        </button>
      ) : null}
      <button type="button" className="pro-trial-banner__close" onClick={dismiss} aria-label="Dismiss offer">
        ×
      </button>
    </div>
  );
}
