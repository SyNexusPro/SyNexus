import { Link } from "react-router-dom";
import { AppScreenshotGallery } from "../components/AppScreenshotGallery";
import { NonCustodialDisclaimer } from "../components/NonCustodialDisclaimer";
import { SupportedWallets } from "../components/SupportedWallets";
import { TrustIndicators } from "../components/TrustIndicators";
import { HOW_SYNEXUS_WORKS, PRIVACY_HIGHLIGHTS, SECURITY_POINTS } from "../config/site";

export function Trust() {
  return (
    <div className="page trust-page">
      <section className="trust-page__hero marketing-panel">
        <p className="trust-page__eyebrow">Trust &amp; safety</p>
        <h1 className="trust-page__title">Built for transparency. You stay in control.</h1>
        <p className="trust-page__lede">
          SyNexus is a non-custodial intelligence app. These pages explain how we handle security, privacy,
          wallets, and risk — so you know exactly what SyNexus does and does not do with your funds.
        </p>
        <TrustIndicators />
      </section>

      <NonCustodialDisclaimer className="trust-page__disclaimer" />

      <nav className="trust-page__subnav" aria-label="Trust sections">
        <a href="#trust-security">Security</a>
        <a href="#trust-privacy">Privacy</a>
        <a href="#trust-how">How it works</a>
        <a href="#trust-wallets">Wallets</a>
        <a href="#trust-screenshots">Screenshots</a>
      </nav>

      <section id="trust-security" className="trust-page__section marketing-panel">
        <h2>Security</h2>
        <p>
          <strong>Sentinel Aegis</strong> is SyNexus&apos;s security &amp; privacy lane — token scams and rug
          heuristics on-chain, plus non-custodial operator hygiene off-chain. Ask Titan or Aegis about privacy,
          phishing, or a suspicious mint before you sign anything.
        </p>
        <ul className="trust-page__bullets">
          {SECURITY_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="trust-page__fineprint">
          No system eliminates smart-contract, bridge, or wallet-compromise risk. Use hardware wallets for size,
          verify URLs, and treat every Sentinel or Oracle output as a starting point — not a guarantee.
        </p>
      </section>

      <section id="trust-privacy" className="trust-page__section marketing-panel">
        <h2>Privacy</h2>
        <p>Summary of how SyNexus handles data. The full policy lives on a dedicated page.</p>
        <ul className="trust-page__bullets">
          {PRIVACY_HIGHLIGHTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <Link className="trust-page__cta" to="/privacy">
          Read full Privacy Policy
        </Link>
      </section>

      <section id="trust-how" className="trust-page__section marketing-panel">
        <h2>How SyNexus works</h2>
        <ol className="trust-page__steps">
          {HOW_SYNEXUS_WORKS.map((step) => (
            <li key={step.step}>
              <span>{step.step}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link className="trust-page__cta" to="/about">
          Mission, Sentinels, and SYN roadmap
        </Link>
      </section>

      <section id="trust-wallets" className="trust-page__section marketing-panel">
        <h2>Supported wallets</h2>
        <p>
          SyNexus opens Jupiter swap flows in your browser. Connect with any Solana wallet that supports those
          transactions — we do not maintain a proprietary wallet.
        </p>
        <SupportedWallets />
      </section>

      <section id="trust-screenshots" className="trust-page__section marketing-panel">
        <h2>App screenshots</h2>
        <p>
          Token scanner, whale tracker, risk score, Pulse alerts, and Titan — the surfaces Google Play
          reviewers and new users expect to see before install.
        </p>
        <AppScreenshotGallery showPlayHint />
      </section>

      <section className="trust-page__section marketing-panel legal-section--risk">
        <h2>Not financial advice</h2>
        <p>
          SyNexus does not recommend any trade. Risk scores, Sentinel bands, alerts, and AI chat are automated
          summaries that may be wrong. Digital assets can lose all value. You are solely responsible for wallet
          security and every transaction you sign.
        </p>
        <Link className="trust-page__cta" to="/disclaimer">
          Read full Disclaimer
        </Link>
        {" · "}
        <Link className="trust-page__cta" to="/terms">
          Terms of Service
        </Link>
      </section>

      <p className="trust-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/contact">Contact support</Link>
      </p>
    </div>
  );
}
