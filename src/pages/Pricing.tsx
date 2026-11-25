import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { requirePaddleClientToken, requirePaddleEnvironment } from "../config/paddle";
import { SYNEXUS_PRICING_PATH } from "../config/proPricing";
import {
  readPricingTiers,
  type BillingFrequency,
  type Tier,
} from "../config/pricingTiers";
import { SYNEXUS_REFUND_POLICY_PATH } from "../config/refundPolicy";
import { PADDLE_COUNTRY_OTHERS, usePaddlePrices } from "../hooks/usePaddlePrices";
import {
  openPaddleCheckout,
  openPaddleCustomerPortal,
} from "../lib/paddleCheckout";
import {
  fetchMembership,
  startComplimentaryTrial,
  type MembershipSnapshot,
} from "../lib/membershipClient";
import { getOperatorAuthSnapshot, subscribeOperatorAuth } from "../lib/operatorAuthStore";
import { getCurrentUser } from "../lib/supabaseData";

export function Pricing() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tierError, setTierError] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<BillingFrequency>("month");
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [country, setCountry] = useState<string>(PADDLE_COUNTRY_OTHERS);
  const [userId, setUserId] = useState(() => getOperatorAuthSnapshot().userId);
  const [email, setEmail] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const { prices, loading, error: priceError } = usePaddlePrices(paddle, country, tiers);

  useEffect(() => {
    try {
      setTiers(readPricingTiers());
      setTierError(null);
    } catch (error) {
      setTierError(error instanceof Error ? error.message : "Pricing tiers are not configured.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    try {
      const token = requirePaddleClientToken();
      const environment = requirePaddleEnvironment();
      void initializePaddle({ token, environment }).then((instance) => {
        if (!cancelled && instance) setPaddle(instance);
      });
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Paddle is not configured.");
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void fetch("/api/paddle/geo", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: { country?: string | null }) => {
        const code = body.country?.trim().toUpperCase();
        if (code) setCountry(code);
        else setCountry(PADDLE_COUNTRY_OTHERS);
      })
      .catch(() => setCountry(PADDLE_COUNTRY_OTHERS));
  }, []);

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

  const frequencyLabel = frequency === "month" ? "month" : "year";

  const sortedTiers = useMemo(() => tiers, [tiers]);

  async function subscribe(tier: Tier) {
    setBusy(true);
    setMessage("");
    try {
      const priceId = tier.priceId[frequency];
      const formatted = prices[priceId];
      if (!formatted) throw new Error("Price is still loading. Try again in a moment.");
      await openPaddleCheckout({
        priceId,
        tierId: tier.id,
        frequency,
        userId,
        email,
      });
      setMessage(`Checkout opened for ${tier.name} at ${formatted}.`);
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
      setMessage("Your complimentary Next Level grant is active when eligible (one per account).");
      const next = await fetchMembership();
      setMembership(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The complimentary grant could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page pricing-page">
      <section className="page__intro">
        <h1 className="page__headline">Pick what fits</h1>
        <p className="page__lede">
          Country-localized prices from Paddle. Subscribe opens a one-page overlay for the exact price shown.
          Advanced unlocks the members-only social network and zero SyNexus trading fees.
        </p>
      </section>

      {(configError || tierError) && (
        <p className="page__lede" role="alert">
          {configError || tierError}
        </p>
      )}

      <div className="pricing-page__toggle" role="group" aria-label="Billing frequency">
        <button
          type="button"
          className={frequency === "month" ? "pricing-page__toggle-btn is-active" : "pricing-page__toggle-btn"}
          onClick={() => setFrequency("month")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={frequency === "year" ? "pricing-page__toggle-btn is-active" : "pricing-page__toggle-btn"}
          onClick={() => setFrequency("year")}
        >
          Yearly
        </button>
      </div>

      {priceError ? (
        <p className="page__lede" role="alert">
          {priceError}
        </p>
      ) : null}

      {sortedTiers.map((tier) => {
        const priceId = tier.priceId[frequency];
        const formatted = prices[priceId];
        return (
          <div
            className={`pulse-card pulse-synexus-pro-wrap pricing-page__sheet${tier.featured ? " pricing-page__sheet--featured" : ""}`}
            key={tier.id}
          >
            <div className="pulse-synexus-pro-promo">
              <div className="pulse-synexus-pro-promo__honeycomb" aria-hidden />
              <p className="pulse-synexus-pro-promo__label">{tier.name}</p>
              <p className="pulse-synexus-pro-promo__price">
                {loading || !formatted ? "…" : formatted}
                <span className="pricing-page__per">/{frequencyLabel}</span>
              </p>
              <p className="pulse-synexus-pro-promo__body">{tier.description}</p>
              <ul className="pulse-synexus-pro-promo__bullets">
                {tier.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="pulse-synexus-pro-promo__cta-wrap">
                <button
                  type="button"
                  className="pulse-button--pro pulse-synexus-pro-promo__cta"
                  disabled={busy || loading || !formatted || Boolean(configError || tierError)}
                  onClick={() => void subscribe(tier)}
                >
                  Subscribe {tier.name}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <section className="marketing-panel pricing-page__links">
        <button
          type="button"
          className="pulse-demo-button"
          disabled={busy || membership?.trialEligible === false}
          onClick={() => void trial()}
        >
          Try Starter free for 30 days (no card)
        </button>
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
          <Link to="/pulse">Pulse</Link>
        </p>
      </section>
    </div>
  );
}

export { SYNEXUS_PRICING_PATH };
