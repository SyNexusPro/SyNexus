import { Link } from "react-router-dom";
import { LEGAL_EFFECTIVE_DATE, OPERATOR_LABEL, PUBLIC_SITE_URL, SUPPORT_EMAIL } from "../config/site";

export function Disclaimer() {
  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">Effective date: {LEGAL_EFFECTIVE_DATE}</p>
      <h1 className="legal-page__title">Disclaimer</h1>
      <p className="legal-page__summary">
        Please read this disclaimer carefully before using Synexus ({PUBLIC_SITE_URL}). By using the Service,
        you acknowledge the following.
      </p>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>Not financial, legal, or tax advice</h2>
        <p>
          Synexus is an <strong>informational technology platform</strong>. Nothing on the Service — including
          &quot;Should I buy this?&quot; verdicts (Avoid · Watch · OK), risk scores, Sentinel alerts, whale
          reads, trade journal stats, Oracle Supreme chat, voice briefings, or marketing content — is
          investment, trading, legal, tax, or accounting advice. We do not recommend buying, selling, or
          holding any digital asset. Consult qualified professionals before making financial decisions.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Non-custodial · you sign every trade</h2>
        <p>
          {OPERATOR_LABEL} is <strong>not</strong> a broker, exchange, custodian, or wallet provider. We never
          hold your SOL, tokens, or seed phrase. Swaps and transfers are initiated by you and signed in your
          own wallet app (Phantom, Solflare, Backpack, etc.). Synexus cannot reverse blockchain transactions or
          recover lost keys.
        </p>
      </section>

      <section className="legal-section marketing-panel legal-section--risk">
        <h2>High risk of loss</h2>
        <p>
          Digital assets and memecoins are highly volatile. You may lose some or all of your investment.
          Smart-contract bugs, rug pulls, liquidity drains, bridge failures, hacks, and regulatory actions can
          cause total loss. <strong>You use Synexus entirely at your own risk.</strong>
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Automated &amp; AI outputs may be wrong</h2>
        <p>
          Risk scores, Sentinel bands, rug flags, momentum reads, and AI-generated text use heuristics and
          third-party data. They may be <strong>incomplete, delayed, inaccurate, or misleading</strong>. An
          &quot;OK&quot; or &quot;Watch&quot; verdict is not a guarantee of safety. Automated systems can miss
          scams or flag legitimate projects incorrectly. Always verify mint addresses and contracts yourself.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Third-party services</h2>
        <p>
          The Service links to or relies on wallets, DEX aggregators (such as Jupiter), RPC providers, chart
          APIs, payment processors, and social platforms we do not control. Their fees, downtime, terms, and
          security are their responsibility — not ours.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>No warranty</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
          kind. We do not guarantee uninterrupted operation, accurate data, or profitable trading outcomes.
          See our <Link to="/terms">Terms of Service</Link> for full warranty and liability limits.
        </p>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Questions</h2>
        <p>
          Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          {" · "}
          <Link to="/contact">Contact &amp; FAQ</Link>
        </p>
      </section>

      <p className="legal-page__note">
        This disclaimer is a user-facing summary. It is not legal advice. Have qualified counsel review all
        legal pages before app-store or marketing submission.
      </p>

      <p className="legal-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/terms">Terms</Link>
        {" · "}
        <Link to="/privacy">Privacy</Link>
        {" · "}
        <Link to="/faq">FAQ</Link>
      </p>
    </div>
  );
}
