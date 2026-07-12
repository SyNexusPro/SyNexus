import { Link } from "react-router-dom";
import { ProDemoButton } from "../components/ProDemoButton";
import {
  getExternalPricingUrl,
  SYNEXUS_PRO_FEATURES,
  SYNEXUS_PRO_OFFER_TAGLINE,
  SYNEXUS_PRO_PRICE_LABEL,
  SYNEXUS_PRO_SUBSCRIBE_LABEL,
  SYNEXUS_PRICING_PATH,
} from "../config/proPricing";
import { SYNEXUS_PRO_TRIAL_DAYS, SYNEXUS_PRO_TRIAL_LABEL } from "../config/proTrial";
import { SYNEXUS_REFUND_POLICY_PATH } from "../config/refundPolicy";

export function Pricing() {
  const externalPricingUrl = getExternalPricingUrl();

  return (
    <div className="page">
      <section className="page__intro">
        <h1 className="page__headline">Pricing</h1>
        <p className="page__lede">
          One plan — full Synexus Pro intelligence. {SYNEXUS_PRO_OFFER_TAGLINE}.
        </p>
      </section>

      <div className="pulse-card pulse-synexus-pro-wrap pricing-page__sheet" id="synexus-pro">
        <div className="pulse-synexus-pro-promo">
          <div className="pulse-synexus-pro-promo__honeycomb" aria-hidden />
          <p className="pulse-synexus-pro-promo__label">Synexus Pro</p>
          <p className="pulse-synexus-pro-promo__price">{SYNEXUS_PRO_PRICE_LABEL}</p>
          <p className="pulse-synexus-pro-promo__headline">Unlimited trading intelligence. One simple price.</p>
          <p className="pulse-synexus-pro-promo__body">
            Sign up for a {SYNEXUS_PRO_TRIAL_DAYS}-day full Pro trial — add a card at checkout. After the trial,
            billing continues at {SYNEXUS_PRO_PRICE_LABEL} unless you cancel. Payments are processed by our
            third-party subscription platform (shown at checkout).
          </p>
          <ul className="pulse-synexus-pro-promo__bullets">
            {SYNEXUS_PRO_FEATURES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="pulse-synexus-pro-promo__cta-wrap">
            <ProDemoButton
              className="pulse-demo-button pulse-demo-button--first pulse-synexus-pro-promo__demo"
              label={`${SYNEXUS_PRO_TRIAL_LABEL} — see everything`}
              goToPulse
              pulseHash="#synexus-pro"
            />
            <Link to="/pulse#synexus-pro" className="pulse-button--pro pulse-synexus-pro-promo__cta">
              {SYNEXUS_PRO_SUBSCRIBE_LABEL}
            </Link>
          </div>
          {externalPricingUrl ? (
            <p className="pricing-page__external">
              <a href={externalPricingUrl} target="_blank" rel="noopener noreferrer">
                View subscription details ↗
              </a>
            </p>
          ) : null}
          <p className="pulse-synexus-pro-promo__disclaimer">
            Not financial advice. Sentinel scores are informational. Cancel anytime from the billing portal linked at checkout.
          </p>
        </div>
      </div>

      <section className="marketing-panel pricing-page__links">
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

/** Stable path for links site-wide. */
export { SYNEXUS_PRICING_PATH };
