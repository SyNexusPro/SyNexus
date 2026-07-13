import { Link } from "react-router-dom";
import { SYNEXUS_REFUND_POLICY_PATH } from "../config/refundPolicy";
import { LEGAL_EFFECTIVE_DATE, OPERATOR_LABEL, SUPPORT_EMAIL } from "../config/site";

const EFFECTIVE_LABEL = `Effective date: ${LEGAL_EFFECTIVE_DATE}`;

export function Privacy() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{EFFECTIVE_LABEL}</p>
      <h1 className="legal-page__title">Privacy Policy</h1>
      <p className="legal-page__summary">
        This Privacy Policy describes how {OPERATOR_LABEL} (&quot;we,&quot; &quot;us&quot;) collects, uses, and
        shares information when you use the Synexus mobile and web application and related services (the
        &quot;Service&quot;). It should be read with our{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>

      <section className="legal-section marketing-panel">
        <h2>Information we collect</h2>
        <p>
          <strong>Account data.</strong> If you create an operator link / account, we may collect email address,
          authentication identifiers, username or display name, and subscription status through our auth provider
          (for example Supabase).
        </p>
        <p>
          <strong>Usage and device data.</strong> We may collect log data such as IP address, browser or app
          version, pages viewed, feature interactions, timestamps, and diagnostic errors to operate and secure
          the Service.
        </p>
        <p>
          <strong>Payment data.</strong> Subscriptions are processed by third-party subscription and payment
          processors (for example Square, shown at checkout). We receive limited billing metadata (such as plan status and
          transaction IDs), not full card numbers, which are handled by the processor under its privacy policy.
          See our <Link to={SYNEXUS_REFUND_POLICY_PATH}>Refund Policy</Link> for billing disputes and refunds.
        </p>
        <p>
          <strong>User content.</strong> If you submit token reports, messages to automated features, or
          feedback, we store that content to operate and improve the Service.
        </p>
        <p>
          <strong>Local storage.</strong> The Service may store preferences, plan flags, and conversation history
          locally on your device (for example via browser or app storage).
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>How we use information</h2>
        <p>
          We use information to provide and maintain the Service; authenticate users; process subscriptions;
          personalize features (including AI and Sentinel tooling); send service-related messages; detect abuse
          and security incidents; comply with law; and improve performance. We do not sell your personal
          information for money. We may use aggregated or de-identified data for analytics and product
          improvement.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>How we share information</h2>
        <p>
          We share information with service providers that help us run the Service—for example hosting,
          authentication, payment processing, analytics, and market-data APIs—under contractual obligations
          appropriate to their role. We may disclose information if required by law, to protect rights and
          safety, or in connection with a merger, acquisition, or asset sale. We may share information when you
          direct us to (for example, opening a third-party wallet or exchange link).
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Retention and security</h2>
        <p>
          We retain information for as long as needed to provide the Service, comply with legal obligations,
          resolve disputes, and enforce agreements. We use reasonable administrative, technical, and organizational
          measures to protect information, but no system is completely secure. You are responsible for safeguarding
          your credentials.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Children</h2>
        <p>
          The Service is not directed to children under eighteen (18). We do not knowingly collect personal
          information from children. If you believe a child has provided us information, contact us so we can
          delete it.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>International users</h2>
        <p>
          We may process information in the United States and other countries where we or our providers operate.
          Those countries may have different data-protection laws than your jurisdiction. Where required, we will
          take steps designed to provide appropriate safeguards for cross-border transfers.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Your choices and rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or export personal
          information, or to object to or restrict certain processing. You may update account details where the
          Service allows, cancel subscriptions through checkout or processor tools, and disconnect your operator
          link. To exercise privacy rights, contact us through channels published in the Service. We may verify
          your request before responding. We will not discriminate against you for exercising applicable privacy
          rights.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Contact us</h2>
        <p>
          Privacy questions or data requests:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          {" · "}
          <Link to="/contact">Contact page</Link>
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the revised policy with an updated
          effective date and provide additional notice where required by law.
        </p>
      </section>

      <p className="legal-page__note">
        This Privacy Policy is provided for transparency and app-store compliance. Have qualified counsel review
        it alongside your data map (Supabase, subscription billing, analytics, and API vendors) before publication.
      </p>

      <p className="legal-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/trust">Trust &amp; privacy summary</Link>
        {" · "}
        <Link to="/contact">Contact</Link>
        {" · "}
        <Link to="/disclaimer">Disclaimer</Link>
        {" · "}
        <Link to="/faq">FAQ</Link>
        {" · "}
        <Link to={SYNEXUS_REFUND_POLICY_PATH}>Refund Policy</Link>
        {" · "}
        <Link to="/terms">Terms of Service</Link>
      </p>
    </div>
  );
}
