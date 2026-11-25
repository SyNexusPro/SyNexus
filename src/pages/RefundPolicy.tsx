import { Link } from "react-router-dom";
import { SYNEXUS_PRO_PRICE_LABEL } from "../config/proPricing";
import { SYNEXUS_PRO_TRIAL_DAYS } from "../config/proTrial";
import { SYNEXUS_REFUND_POLICY_PATH } from "../config/refundPolicy";
import { LEGAL_EFFECTIVE_DATE, OPERATOR_LABEL, SUPPORT_EMAIL } from "../config/site";

const EFFECTIVE_LABEL = `Effective date: ${LEGAL_EFFECTIVE_DATE}`;

export function RefundPolicy() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{EFFECTIVE_LABEL}</p>
      <h1 className="legal-page__title">Refund Policy</h1>
      <p className="legal-page__summary">
        This Refund Policy explains how refunds, cancellations, and billing disputes work for SyNexus membership
        (Starter, Pro, and Advanced — also described as Next Level / Pantheon entitlements) and other paid features
        offered by {OPERATOR_LABEL} (&quot;we,&quot; &quot;us&quot;). It supplements our{" "}
        <Link to="/terms">Terms of Service</Link> and should be read with our{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <section className="legal-section marketing-panel">
        <h2>Overview</h2>
        <p>
          Membership is sold as recurring subscriptions. Starter-class access is listed around{" "}
          <strong>{SYNEXUS_PRO_PRICE_LABEL}</strong>; Advanced / Pantheon-class access around{" "}
          <strong>$20/month</strong>. Pro sits between those offers. The amount charged is the localized price
          (and any tax) shown at checkout, including monthly or yearly options. Web checkout and recurring billing
          are processed by <strong>Paddle</strong>. Paddle or its payment partners may appear on your card or bank
          statement.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Complimentary Starter / Next Level grant</h2>
        <p>
          Where offered, eligible verified accounts may receive a one-time{" "}
          <strong>{SYNEXUS_PRO_TRIAL_DAYS}-day complimentary Starter / Next Level grant</strong> with no payment
          method required. This is a promotional in-app grant, not a Paddle subscription trial, and it can be used
          only once per account. You will not be charged until you subscribe. If you subscribe after the grant ends,
          your payment method will be charged the plan price shown at checkout and billing will continue on a
          recurring basis until you cancel.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Cancellation</h2>
        <p>
          You may cancel Starter, Pro, or Advanced at any time through the Paddle customer portal or subscription
          tools linked from Pricing, Pulse, and your account settings. Cancellation stops future renewals; it does
          not automatically refund charges already processed. Paid access typically continues until the end of the
          current billing period unless otherwise stated at checkout or required by law.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Refund eligibility</h2>
        <p>
          Unless mandatory consumer law in your jurisdiction requires otherwise,{" "}
          <strong>subscription fees are non-refundable</strong> once a billing period has started, including
          partial periods. We generally do not provide refunds because you changed your mind, did not use the
          Service during a billing period, or forgot to cancel before renewal.
        </p>
        <p>
          We may issue a refund or account credit at our sole discretion, or when required by law, in cases
          such as:
        </p>
        <ul>
          <li>Duplicate or erroneous charges verified on our side or by the payment processor</li>
          <li>Technical failure that prevented meaningful access to paid features for a sustained period</li>
          <li>Charges after a cancellation that was confirmed before the renewal date</li>
          <li>Other situations where applicable law grants you a refund right</li>
        </ul>
      </section>

      <section className="legal-section marketing-panel">
        <h2>How to request a refund</h2>
        <p>
          Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address tied to your SyNexus account
          within <strong>14 days</strong> of the charge. Include the date and amount charged, the email on your
          account, and a brief description of the issue. We will review your request and respond within a
          reasonable time. Approved refunds are processed through the original payment method; timing
          depends on your bank or card issuer.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Chargebacks and disputes</h2>
        <p>
          If you believe a charge is incorrect, contact us first so we can investigate. Initiating a
          chargeback without contacting support may delay resolution and can result in suspension of paid
          features while the dispute is open.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Changes</h2>
        <p>
          We may update this Refund Policy from time to time. The effective date at the top of this page will
          change when we do. Material changes may also be reflected in the Terms or at checkout where required.
        </p>
      </section>

      <p className="legal-page__note">
        This Refund Policy is provided for transparency and app-store compliance. It is not legal advice. Have
        qualified counsel review it for your entity and jurisdictions before relying on it for compliance.
        Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        {" · "}
        <Link to="/contact">Contact</Link>
      </p>

      <p className="legal-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/pricing">Pricing</Link>
        {" · "}
        <Link to="/terms">Terms</Link>
        {" · "}
        <Link to="/privacy">Privacy Policy</Link>
        {" · "}
        <Link to="/faq">FAQ</Link>
      </p>
    </div>
  );
}

export { SYNEXUS_REFUND_POLICY_PATH };
