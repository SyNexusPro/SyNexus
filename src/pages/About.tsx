import { Link } from "react-router-dom";
import { AppScreenshotGallery } from "../components/AppScreenshotGallery";
import { HOW_SYNEXUS_WORKS, SYN_COIN_ROADMAP } from "../config/site";
import { SYN_PUMPFUN_URL, SYN_MINT, SYN_SYMBOL } from "../config/synToken";

export function About() {
  return (
    <div className="page about-page">
      <section className="about-page__hero marketing-panel">
        <p className="about-page__eyebrow">About Synexus</p>
        <h1 className="about-page__title">Safer Solana trading starts with intelligence, not hype.</h1>
        <p className="about-page__lede">
          Synexus is an AI-powered command center for Solana traders — built to surface scams, whale moves, and
          momentum shifts before you connect a wallet. We are non-custodial: you keep your keys; we deliver the
          read.
        </p>
      </section>

      <section className="about-page__section marketing-panel">
        <h2>Our mission</h2>
        <p>
          Retail traders on Solana move faster than most tools can warn them. Rugs, thin liquidity, and whale
          exits often hit before a chart update. Synexus exists to close that gap: combine Sentinel automation,
          community reports, and Oracle Supreme AI into one feed so you can scan first and execute when you are
          ready — always on your own terms.
        </p>
        <p>
          We are not a broker, exchange, or custodian. Synexus organizes data, risk heuristics, and third-party
          swap shortcuts. Nothing we show is a recommendation to buy or sell any asset.
        </p>
      </section>

      <section className="about-page__section marketing-panel">
        <h2>How Synexus works</h2>
        <ol className="about-page__steps">
          {HOW_SYNEXUS_WORKS.map((step) => (
            <li key={step.step}>
              <span className="about-page__step-num">{step.step}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link className="about-page__link" to="/trust">
          Security, privacy, and supported wallets →
        </Link>
      </section>

      <section className="about-page__section marketing-panel">
        <h2>Oracle Supreme</h2>
        <p>
          Oracle Supreme is Synexus&apos;s conversational AI layer — the strategic voice of the network. It
          synthesizes Sentinel intel, token metadata, and market context into briefings you can read or hear.
          Ask about a coin, request a risk summary, or get a plain-language explanation of why a token flagged
          Warning or Danger.
        </p>
        <p>
          Oracle Supreme is informational only. It can be incomplete, delayed, or wrong. Always verify mint
          addresses and on-chain data before trading.
        </p>
      </section>

      <section className="about-page__section marketing-panel">
        <h2>The Synexus Sentinels</h2>
        <p>
          Four Sentinel lanes — <strong>Aegis</strong>, <strong>Pulse</strong>, <strong>Titan</strong>, and{" "}
          <strong>Cipher</strong> — run parallel scans on every tracked token:
        </p>
        <ul className="about-page__bullets">
          <li>
            <strong>Aegis</strong> — contract and liquidity integrity signals
          </li>
          <li>
            <strong>Pulse</strong> — volume, momentum, and volatility spikes
          </li>
          <li>
            <strong>Titan</strong> — whale concentration and large-wallet flows
          </li>
          <li>
            <strong>Cipher</strong> — pattern matching, naming traps, and swarm reports
          </li>
        </ul>
        <p>
          Sentinels feed the risk score, alert cards on Pulse, and Oracle Supreme directives. Synexus Pro
          subscribers get faster refresh and deeper precision on these surfaces.
        </p>
      </section>

      <section className="about-page__section marketing-panel about-page__section--syn-live">
        <p className="about-page__eyebrow">Community token</p>
        <h2>$SyN community is live on pump.fun</h2>
        <p>
          The Synexus community token ({SYN_SYMBOL}) has a home on pump.fun. Paste the mint in{" "}
          <strong>Should I buy this?</strong> for a Sentinel read before you ape — then buy only through your
          own wallet.
        </p>
        <p className="about-page__mint">
          Mint: <code>{SYN_MINT}</code>
        </p>
        <div className="about-page__syn-actions">
          <a
            className="about-page__syn-cta"
            href={SYN_PUMPFUN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open $SyN community
          </a>
          <Link className="about-page__link" to="/token/hivemind-sol">
            Scan {SYN_SYMBOL} in Synexus →
          </Link>
        </div>
      </section>

      <section id="syn-roadmap" className="about-page__section marketing-panel about-page__section--roadmap">
        <h2>Syn coin roadmap</h2>
        <p className="about-page__roadmap-note">
          SYN is live on pump.fun. Tokenomics, treasury routing, and legal availability for other jurisdictions
          will be updated as the ecosystem matures. Nothing here is an offer of securities.
        </p>
        <div className="about-page__roadmap">
          {SYN_COIN_ROADMAP.map((phase) => (
            <article key={phase.phase} className="about-page__roadmap-card">
              <header>
                <h3>{phase.phase}</h3>
                <span className="about-page__roadmap-status">{phase.status}</span>
              </header>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <Link className="about-page__link" to="/hub#hub-trading-fees">
          Trading fees and treasury allocation →
        </Link>
      </section>

      <section className="about-page__section marketing-panel">
        <h2>See it in action</h2>
        <p>Core surfaces traders use every session — token scanner, whale tracker, risk score, alerts, and AI.</p>
        <AppScreenshotGallery showPlayHint />
      </section>

      <p className="about-page__back">
        <Link to="/">← Back to feed</Link>
        {" · "}
        <Link to="/contact">Contact &amp; FAQ</Link>
      </p>
    </div>
  );
}
