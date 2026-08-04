import { Link } from "react-router-dom";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";

const TOOLS = [
  {
    title: "Affiliate growth",
    body: "Referral handles, tiers, and partner rails for growing distribution.",
    to: "/hub#hub-affiliate",
  },
  {
    title: "Token utility & staking",
    body: "SYN utility map, staking status, and fee transparency.",
    to: "/hub#hub-utility",
  },
  {
    title: "Liquidity treasury",
    body: "Track treasury routing and liquidity posture.",
    to: "/liquidity-treasury",
  },
  {
    title: "Pricing & Pro",
    body: "SyNexusPro plans for deeper Sentinel and Titan access.",
    to: "/pricing",
  },
  {
    title: "Site analytics",
    body: "Operator analytics for growth and conversion loops.",
    to: "/analytics",
  },
  {
    title: "Marketing command",
    body: "Campaign and content ops for the SyNexus brand system.",
    to: "/marketing-command",
  },
] as const;

export function BusinessTools() {
  const openTitan = useOpenTitanChat();

  return (
    <div className="page tool-page">
      <section className="tool-page__hero marketing-panel">
        <p className="tool-page__eyebrow">Business Tools</p>
        <h1 className="tool-page__title">Analyze, optimize & grow</h1>
        <p className="tool-page__lede">
          Operator tools for affiliates, treasury, pricing, analytics, and GTM — plus Titan for business
          briefings.
        </p>
      </section>

      <ul className="tool-page__grid">
        {TOOLS.map((tool) => (
          <li key={tool.to}>
            <Link className="tool-card marketing-panel" to={tool.to}>
              <h2>{tool.title}</h2>
              <p>{tool.body}</p>
              <span>Open →</span>
            </Link>
          </li>
        ))}
        <li>
          <button type="button" className="tool-card marketing-panel" onClick={openTitan}>
            <h2>Ask Titan</h2>
            <p>Business questions, GTM drafts, and research briefs on demand.</p>
            <span>Open Titan →</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
