import { useState } from "react";
import { SYNEXUS_PRO_TRIAL_DAYS, SYNEXUS_PRO_TRIAL_LABEL } from "../config/proTrial";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import { SYNEXUS_PRO_PRICE_LABEL } from "../config/proPricing";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";
import { isProTrialActive } from "../lib/proDemo";
import { getCurrentUser } from "../lib/supabaseData";
import { redirectToProCheckout, startProCheckout } from "../lib/squareCheckout";
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
    setError(false);
    try {
      setBusy(true);
      const user = await getCurrentUser().catch(() => null);
      const checkout = await startProCheckout({
        userId: user?.id,
        email: user?.email,
      });
      if (!checkout.ok) throw new Error(checkout.error);
      redirectToProCheckout(checkout.url);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const detail = error
    ? "Checkout couldn't open. Tap Subscribe to retry."
    : !linked
      ? `${SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial · card at checkout · then ${SYNEXUS_PRO_PRICE_LABEL}`
      : `${SYNEXUS_PRO_TRIAL_LABEL} active or available · ${SYNEXUS_PRO_PRICE_LABEL} after trial · cancel anytime`;

  return (
    <div className="pro-trial-banner" role="region" aria-label="SyNexusPro subscription">
      <div className="pro-trial-banner__text">
        <span className="pro-trial-banner__headline">SyNexusPro</span>
        <span className="pro-trial-banner__detail">{detail}</span>
      </div>
      <ProDemoButton
        className="pro-trial-banner__demo"
        label={linked ? `Open ${SYNEXUS_PRO_TRIAL_LABEL}` : `Enter ${DEFAULT_TITAN_BOT_NAME} · sign up free`}
      />
      <button
        type="button"
        className="pro-trial-banner__cta"
        disabled={busy}
        onClick={() => void startCheckout()}
      >
        {busy ? "Opening…" : "Subscribe"}
      </button>
      <button type="button" className="pro-trial-banner__close" onClick={dismiss} aria-label="Dismiss offer">
        ×
      </button>
    </div>
  );
}
