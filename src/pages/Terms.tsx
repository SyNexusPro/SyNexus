import { Link } from "react-router-dom";

const EFFECTIVE_LABEL = "Effective date: May 4, 2026";

export function Terms() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{EFFECTIVE_LABEL}</p>
      <h1 className="legal-page__title">Terms of Service</h1>
      <p className="legal-page__summary">
        These Terms govern your access to HiveMind (the “Service”). By using the Service, you agree to
        them. If you do not agree, do not use the Service.
      </p>

      <section className="legal-section marketing-panel">
        <h2>Not financial advice</h2>
        <p>
          HiveMind provides informational tooling, dashboards, summaries, alerts, AI-generated content, and links
          to third-party sites. Nothing on the Service is investment, trading, legal, tax, or other professional
          advice. We do not recommend buying, selling, or holding any asset. Always do your own research and
          consult qualified professionals before making decisions.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>Risk · use at your own risk</h2>
        <p>
          Digital assets and trading involve substantial risk of loss. Prices are volatile; projects may fail,
          liquidity may disappear, and smart-contract or chain-level issues may occur. You use HiveMind{" "}
          <strong>entirely at your own risk</strong>. Information may be incomplete, delayed, or inaccurate.
          Past or simulated patterns do not predict future results. You are solely responsible for your own
          decisions and outcomes.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Accounts</h2>
        <p>
          Where we offer registration or sign-in (for example via Supabase or similar), you must provide
          accurate information and safeguard your credentials. You are responsible for all activity under your
          account. We may suspend or terminate access if we reasonably believe terms are violated or the Service
          is misused.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Payments and subscriptions</h2>
        <p>
          Paid plans may be processed by third-party payment processors (for example Stripe). Fees, renewal,
          taxes, invoicing, and refunds are governed by the processor&apos;s policies and applicable law unless we
          state otherwise at checkout. You authorize us and our processors to charge your chosen payment method
          for recurring subscriptions until you cancel in accordance with the checkout terms. Failed payments or
          chargebacks may result in suspension of paid features.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Third parties</h2>
        <p>
          The Service may link to or rely on wallets, explorers, charts, exchanges, RPC providers, analytics APIs,
          social platforms, marketing tools, and other third parties over which we have no control. Their terms,
          privacy policies, fees, outages, bugs, hacks, scams, misleading data, downtime, geographic blocks,
          regulatory actions, availability, and behavior are their responsibility—not ours—even when we provide
          in-app shortcuts (for example opens in a new tab). Your use of those services is at your own risk subject
          to those third-party terms.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>Disclaimer of warranties</h2>
        <p>
          The Service is provided <strong>&quot;as is&quot;</strong> and <strong>&quot;as available.&quot;</strong> To the fullest extent
          permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for
          a particular purpose, and non-infringement. We do not warrant uninterrupted, error-free, or virus-free
          operation.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, HiveMind and its owners, affiliates, contractors, and
          contributors are not liable for any indirect, incidental, special, consequential, exemplary, or
          punitive damages, or for lost profits, data, goodwill, or trading losses, arising from your use of the
          Service or reliance on its content—even if advised of the possibility. Our aggregate liability for any
          claim arising from the Service shall not exceed the greater of (a) the amount you paid us for the Service
          in the twelve (12) months before the claim, or (b) one hundred US dollars ($100), if you have not paid
          us. Some jurisdictions do not allow certain limits; in those jurisdictions, liability is limited to
          the maximum permitted by law.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Indemnity</h2>
        <p>
          You agree to defend and indemnify HiveMind and those acting on its behalf against claims, losses, and
          expenses (including reasonable attorneys&apos; fees) arising from your misuse of the Service, violation of
          these Terms, violation of applicable law or third-party rights, or trades and other activity you
          initiate after using informational features of the Service.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Changes</h2>
        <p>
          We may update these Terms from time to time. We will indicate the updated effective date at the top.
          Continued use after changes means you accept the revised Terms.
        </p>
      </section>

      <p className="legal-page__note">
        This document is intended to summarize key risk and legal posture for users and is not a substitute for
        counsel. For questions about these Terms, contact us through channels published on{" "}
        <a href="https://hivemindtoken.ai/" target="_blank" rel="noopener noreferrer">
          hivemindtoken.ai
        </a>
        .
      </p>

      <p className="legal-page__back">
        <Link to="/">← Back to feed</Link>
      </p>
    </div>
  );
}
