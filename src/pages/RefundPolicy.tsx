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
        This Refund Policy explains how refunds, cancellations, and billing disputes work for Synexus Pro and
        other paid features offered by {OPERATOR_LABEL} (&quot;we,&quot; &quot;us&quot;). It supplements our{" "}
        <Link to="/terms">Terms of Service</Link> and should be read with our{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <section className="legal-section marketing-panel">
        <h2>Overview</h2>
        <p>
          Synexus Pro is a recurring subscription billed at{" "}
          <strong>{SYNEXUS_PRO_PRICE_LABEL}</strong> (plus applicable taxes where required). Checkout and
          recurring billing are processed by our third-party subscription and payment platform (the provider
          shown at checkout). That provider may appear on your card or bank statement for your subscription.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Free trial</h2>
        <p>
          Where offered, Synexus Pro includes a <strong>{SYNEXUS_PRO_TRIAL_DAYS}-day free trial</strong> after
          you create and verify your account and add a payment method at checkout. You will not be charged the
          subscription price during the trial if you cancel before the trial ends. If you do not cancel before
          the trial ends, your payment method will be charged {SYNEXUS_PRO_PRICE_LABEL} and billing will
          continue on a recurring monthly basis until you cancel.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Cancellation</h2>
        <p>
          You may cancel Synexus Pro at any time through the billing portal or subscription tools linked
          from Pulse and your account settings. Cancellation stops future renewals; it does not automatically
          refund charges already processed. Paid access typically continues until the end of the current billing
          period unless otherwise stated at checkout or required by law.
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
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address tied to your Synexus account
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
