import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SYNEXUS_PRICING_PATH } from "../config/proPricing";
import { SYNEXUS_REFUND_POLICY_PATH } from "../config/refundPolicy";
import type { PaddlePlanId } from "../config/paddle";
import { getOperatorAuthSnapshot, subscribeOperatorAuth } from "../lib/operatorAuthStore";
import {
  fetchMembership,
  refreshMembershipAfterRestore,
  startComplimentaryTrial,
  type MembershipSnapshot,
} from "../lib/membershipClient";
import {
  openPaddleCheckout,
  openPaddleCustomerPortal,
  paddleCheckoutAvailable,
  paddleConfiguredButAwaitingApproval,
} from "../lib/paddleCheckout";
import { getCurrentUser } from "../lib/supabaseData";

const TIERS: Array<{
  name: string;
  plan: PaddlePlanId;
  price: string;
  points: string[];
}> = [
  {
    name: "Next Level",
    plan: "next_level",
    price: "$10/month",
    points: [
      "Hera conversation, market discovery, and token security checks",
      "Connect any Solana wallet via WalletConnect",
      "Read-only holdings and advisory token-risk analysis",
      "30-day free trial when eligible (one trial per account across all plans)",
      "The members-only social network is not included",
      "Live in-app swaps stay off until trading is approved",
    ],
  },
  {
    name: "Pantheon",
    plan: "pantheon",
    price: "$20/month",
    points: [
      "Everything in Next Level",
      "Members-only social access",
      "Premium Hera capabilities",
      "30-day free trial when eligible (one trial per account across all plans)",
      "Future zero SyNexus platform trading/swap fees (when trading is enabled), subject to published terms",
      "Blockchain and third-party venue fees still apply",
      "Pantheon is a member plan. It does not open owner controls",
    ],
  },
];

export function Pricing() {
  const paddleReady = paddleCheckoutAvailable();
  const paddleAwaiting = paddleConfiguredButAwaitingApproval();
  const [userId, setUserId] = useState(() => getOperatorAuthSnapshot().userId);
  const [email, setEmail] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeOperatorAuth(() => {
    setUserId(getOperatorAuthSnapshot().userId);
  }), []);

  useEffect(() => {
    if (!userId) {
      setMembership(null);
      setEmail(null);
      return;
    }
    void getCurrentUser()
      .then((user) => setEmail(user?.email ?? null))
      .catch(() => setEmail(null));
    void fetchMembership()
      .then(setMembership)
      .catch(() => setMembership(null));
  }, [userId]);

  async function buy(plan: PaddlePlanId) {
    setBusy(true);
    setMessage("");
    try {
      if (!userId) throw new Error("Sign in before starting checkout.");
      if (!paddleReady) {
        throw new Error(
          paddleAwaiting
            ? "Paddle live checkout is configured but awaiting your approval flag (VITE_PADDLE_LIVE_CHECKOUT)."
            : "Web checkout is not available yet.",
        );
      }
      await openPaddleCheckout({
        plan,
        userId,
        email,
        trialEligible: membership?.trialEligible !== false,
      });
      setMessage("Checkout opened. Membership updates after Paddle confirms the subscription.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    setMessage("");
    try {
      const url = await openPaddleCustomerPortal();
      window.location.href = url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open the subscription portal.");
    } finally {
      setBusy(false);
    }
  }

  async function trial() {
    setBusy(true);
    setMessage("");
    try {
      await startComplimentaryTrial();
      const next = await refreshMembershipAfterRestore();
      setMembership(next);
      setMessage(
        "Your 30-day complimentary Next Level grant is active. It is not a store subscription trial, does not renew, does not require a card, and does not include the social network.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The complimentary grant could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <section className="page__intro">
        <h1 className="page__headline">Pick what fits</h1>
        <p className="page__lede">
          Next Level ($10/mo) unlocks Hera and market tools. Pantheon ($20/mo) adds the community feed and $0 SyNexus
          trading fees. Both plans include a 30-day free trial when you are still trial-eligible. Network fees from
          Solana and other apps still apply.
        </p>
        {paddleAwaiting ? (
          <p className="page__lede">
            Paddle credentials are present. Live web checkout stays off until you set{" "}
            <code>VITE_PADDLE_LIVE_CHECKOUT=true</code> after business eligibility confirmation.
          </p>
        ) : null}
      </section>

      {TIERS.map((tier) => (
        <div className="pulse-card pulse-synexus-pro-wrap pricing-page__sheet" key={tier.name}>
          <div className="pulse-synexus-pro-promo">
            <div className="pulse-synexus-pro-promo__honeycomb" aria-hidden />
            <p className="pulse-synexus-pro-promo__label">{tier.name}</p>
            <p className="pulse-synexus-pro-promo__price">{tier.price}</p>
            <ul className="pulse-synexus-pro-promo__bullets">
              {tier.points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="pulse-synexus-pro-promo__body">
              Solana network fees and fees charged by other venues are separate. SyNexus does not keep those.
            </p>
            <div className="pulse-synexus-pro-promo__cta-wrap">
              {paddleReady ? (
                <button
                  type="button"
                  className="pulse-button--pro pulse-synexus-pro-promo__cta"
                  disabled={busy}
                  onClick={() => void buy(tier.plan)}
                >
                  Start {tier.name} — {tier.price}
                </button>
              ) : (
                <p className="pulse-synexus-pro-promo__body">
                  {paddleAwaiting
                    ? "Paddle checkout is ready but not live yet."
                    : "Web checkout is not configured in this build."}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      <section className="marketing-panel pricing-page__links">
        <button type="button" className="pulse-demo-button" disabled={busy || membership?.trialEligible === false} onClick={() => void trial()}>
          Try Next Level free for 30 days (no card)
        </button>
        <p className="page__lede">
          One free trial per signed-in account across complimentary and Paddle plans. Community access stays Pantheon-only.
        </p>
        {membership?.manageSubscription ? (
          <button type="button" className="pulse-demo-button" disabled={busy} onClick={() => void manage()}>
            Manage subscription
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
