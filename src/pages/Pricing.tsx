import { useState } from "react";
import { Link } from "react-router-dom";
import { SYNEXUS_PRICING_PATH } from "../config/proPricing";
import { SYNEXUS_REFUND_POLICY_PATH } from "../config/refundPolicy";
import { startComplimentaryTrial } from "../lib/membershipClient";
import {
  nativePurchasesAvailable,
  purchaseErrorMessage,
  purchaseNativePackage,
  restoreNativePurchases,
  type NativePackageId,
} from "../lib/revenuecatNative";
import { refreshMembershipAfterRestore } from "../lib/membershipClient";

const TIERS = [
  {
    name: "Next Level",
    price: "$10/month",
    annual: "$96/year",
    monthly: "next_level_monthly" as NativePackageId,
    yearly: "next_level_annual" as NativePackageId,
    points: [
      "Hera conversation, market discovery, and token security checks",
      "Standard alerts, wallet access, and swaps",
      "SyNexus swap fee 0.05%",
      "The members-only social network is not included",
    ],
  },
  {
    name: "Pantheon",
    price: "$20/month",
    annual: null,
    monthly: "pantheon_monthly" as NativePackageId,
    yearly: null,
    points: [
      "Everything in Next Level",
      "The members-only social network",
      "No SyNexus trading or swap fee",
      "Pantheon is a member plan. It does not open owner controls",
    ],
  },
];

export function Pricing() {
  const native = nativePurchasesAvailable();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function buy(packageId: NativePackageId) {
    setBusy(true);
    setMessage("");
    try {
      await purchaseNativePackage(packageId);
      await refreshMembershipAfterRestore();
      setMessage("Purchase sent. Membership updates after the store confirms it.");
    } catch (error) {
      setMessage(purchaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setMessage("");
    try {
      await restoreNativePurchases();
      const membership = await refreshMembershipAfterRestore();
      setMessage(membership.tier === "free" ? "No active store subscription was found." : "Purchases restored.");
    } catch (error) {
      setMessage(purchaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function trial() {
    setBusy(true);
    setMessage("");
    try {
      await startComplimentaryTrial();
      setMessage("Your 30-day Next Level trial is active. It does not renew and it does not include the social network.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The trial could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <section className="page__intro">
        <h1 className="page__headline">Pricing</h1>
        <p className="page__lede">Next Level is $10 a month. Pantheon is $20 a month and includes the social network with no SyNexus swap fee.</p>
      </section>

      {TIERS.map((tier) => (
        <div className="pulse-card pulse-synexus-pro-wrap pricing-page__sheet" key={tier.name}>
          <div className="pulse-synexus-pro-promo">
            <div className="pulse-synexus-pro-promo__honeycomb" aria-hidden />
            <p className="pulse-synexus-pro-promo__label">{tier.name}</p>
            <p className="pulse-synexus-pro-promo__price">{tier.price}</p>
            {tier.annual ? <p className="pulse-synexus-pro-promo__headline">or {tier.annual}</p> : null}
            <ul className="pulse-synexus-pro-promo__bullets">
              {tier.points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="pulse-synexus-pro-promo__body">
              Solana network fees and fees charged by other venues are separate. SyNexus does not keep those.
            </p>
            <div className="pulse-synexus-pro-promo__cta-wrap">
              {native ? (
                <>
                  <button type="button" className="pulse-button--pro pulse-synexus-pro-promo__cta" disabled={busy} onClick={() => void buy(tier.monthly)}>
                    Subscribe {tier.price}
                  </button>
                  {tier.yearly ? (
                    <button type="button" className="pulse-button--pro pulse-synexus-pro-promo__cta" disabled={busy} onClick={() => void buy(tier.yearly)}>
                      Subscribe {tier.annual}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="pulse-synexus-pro-promo__body">Web checkout is not available yet. Store purchases open in the iOS and Android app.</p>
              )}
            </div>
          </div>
        </div>
      ))}

      <section className="marketing-panel pricing-page__links">
        <button type="button" className="pulse-demo-button" disabled={busy} onClick={() => void trial()}>
          Start the 30-day trial
        </button>
        {native ? (
          <button type="button" className="pulse-demo-button" disabled={busy} onClick={() => void restore()}>
            Restore purchases
          </button>
        ) : null}
        {message ? <p>{message}</p> : null}
        <p>
          <Link to="/faq">FAQ</Link>
          {" · "}
          <Link to={SYNEXUS_REFUND_POLICY_PATH}>Refund Policy</Link>
          {" · "}
          <Link to="/terms">Terms</Link>
          {" · "}
          <Link to="/pulse">Pulse &amp; Sentinels</Link>
        </p>
      </section>
    </div>
  );
}

export { SYNEXUS_PRICING_PATH };
