import { Link } from "react-router-dom";
import { FAQ_ITEMS } from "../config/site";

const FEATURES = [
  {
    id: "scan",
    title: "Should I buy this?",
    body:
      "Paste any Solana mint or symbol for an instant Avoid, Watch, or OK verdict — plus risk score, liquidity read, whale activity, and rug-pattern flags. Three free deep scans for new visitors.",
    link: "/blog/token-research-guide-should-i-buy-this",
    linkLabel: "Token research guide →",
  },
  {
    id: "sentinels",
    title: "Four Sentinel lanes",
    body:
      "Aegis (security), Pulse (momentum), Leviathan (whales), and Cipher (patterns & reports) run in parallel. One fused read instead of four disconnected dashboards.",
    link: "/blog/how-synexus-sentinel-scoring-works",
    linkLabel: "How scoring works →",
  },
  {
    id: "commander",
    title: "Titan AI commander",
    body:
      "Your private briefing officer — fuses Aegis, Pulse, Leviathan, and Cipher into plain-English answers. Renameable; default persona is encoded server-side.",
    link: "/blog/using-titan-ai-for-crypto-research",
    linkLabel: "Using Titan safely →",
  },
  {
    id: "pulse",
    title: "Pulse operator hub",
    body:
      "Accounts, watchlists, wallet performance stats, SyNexusPro billing, and the full Sentinel grid for daily operators.",
    link: "/pulse",
    linkLabel: "Open Pulse →",
  },
  {
    id: "alerts",
    title: "Real-time alerts",
    body:
      "Warning and danger bands surface on the home feed and Pulse when confidence drops or harm signals accelerate — scan before you chase candles.",
    link: "/blog/red-flags-before-you-buy-any-memecoin",
    linkLabel: "Red flags checklist →",
  },
  {
    id: "trade",
    title: "Non-custodial swaps",
    body:
      "Review a Sentinel read, then buy or sell through Jupiter shortcuts. Phantom, Solflare, and Backpack sign every transaction — SyNexus routes intel, not custody.",
    link: "/blog/non-custodial-trading-why-it-matters",
    linkLabel: "Why non-custodial →",
  },
] as const;

const EDUCATION_LINKS = [
  { to: "/blog/how-to-spot-crypto-scams-on-solana", label: "Spot crypto scams" },
  { to: "/blog/solana-wallet-security-basics", label: "Wallet security" },
  { to: "/blog/ai-trading-assistants-what-they-can-and-cannot-do", label: "AI trading limits" },
  { to: "/blog/weekly-solana-market-outlook-july-2026", label: "Weekly outlook" },
  { to: "/blog/memecoin-season-survival-guide", label: "Memecoin survival" },
  { to: "/blog/how-to-verify-a-token-before-swapping", label: "Verify before swap" },
] as const;

const FAQ_PREVIEW = FAQ_ITEMS.slice(0, 8);

export function HomeEducationalHub() {
  return (
    <>
      <section className="home-edu marketing-panel" aria-labelledby="home-edu-features">
        <div className="home-edu__head">
          <p className="home-edu__eyebrow">Platform guide</p>
          <h2 id="home-edu-features" className="home-edu__title">
            What SyNexus does for Solana traders
          </h2>
          <p className="home-edu__lede">
            SyNexus is an AI-powered research and alert layer for Solana — not a custodial exchange. Scan first,
            understand each feature, then trade in your own wallet when you are ready.
          </p>
        </div>
        <div className="home-edu__grid">
          {FEATURES.map((feature) => (
            <article key={feature.id} className="home-edu__card">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <Link to={feature.link}>{feature.linkLabel}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-edu marketing-panel" aria-labelledby="home-edu-learn">
        <div className="home-edu__head">
          <p className="home-edu__eyebrow">SyNexus Journal</p>
          <h2 id="home-edu-learn" className="home-edu__title">
            Crypto education — written for this platform
          </h2>
          <p className="home-edu__lede">
            Original guides on scams, wallet safety, AI research, token verification, and weekly market context.
            No copied fluff — every article links back to tools you can use on synexus.pro today.
          </p>
        </div>
        <ul className="home-edu__links">
          {EDUCATION_LINKS.map((item) => (
            <li key={item.to}>
              <Link to={item.to}>{item.label}</Link>
            </li>
          ))}
        </ul>
        <p className="home-edu__more">
          <Link to="/blog">Browse all articles →</Link>
          {" · "}
          <Link to="/about">About SyNexus</Link>
        </p>
      </section>

      <section className="home-edu home-edu--faq marketing-panel" aria-labelledby="home-edu-faq">
        <div className="home-edu__head">
          <p className="home-edu__eyebrow">FAQ</p>
          <h2 id="home-edu-faq" className="home-edu__title">
            Common questions
          </h2>
        </div>
        <dl className="home-edu__faq">
          {FAQ_PREVIEW.map((item) => (
            <div key={item.q} className="home-edu__faq-item">
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="home-edu__more">
          <Link to="/faq">Full FAQ →</Link>
          {" · "}
          <Link to="/contact">Contact support</Link>
        </p>
      </section>
    </>
  );
}
