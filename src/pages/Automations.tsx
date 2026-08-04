import { Link } from "react-router-dom";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";

export function Automations() {
  const openTitan = useOpenTitanChat();

  return (
    <div className="page tool-page">
      <section className="tool-page__hero marketing-panel">
        <p className="tool-page__eyebrow">Automations</p>
        <h1 className="tool-page__title">AI workflows that work for you</h1>
        <p className="tool-page__lede">
          Sentinel lanes, Pulse alerts, and Titan workflows — automate monitoring so you catch risk and
          momentum earlier.
        </p>
      </section>

      <ul className="tool-page__grid">
        <li>
          <Link className="tool-card marketing-panel" to="/pulse">
            <h2>Pulse automations</h2>
            <p>Account, alert, and Sentinel control surfaces in one place.</p>
            <span>Open Pulse →</span>
          </Link>
        </li>
        <li>
          <button type="button" className="tool-card marketing-panel" onClick={openTitan}>
            <h2>Titan workflows</h2>
            <p>Ask Titan to watch narratives, summarize movers, or brief a mint.</p>
            <span>Open Titan →</span>
          </button>
        </li>
        <li>
          <Link className="tool-card marketing-panel" to="/#scan">
            <h2>Scan automation</h2>
            <p>Should-I-buy risk reads before you sign a swap.</p>
            <span>Open scanner →</span>
          </Link>
        </li>
        <li>
          <Link className="tool-card marketing-panel" to="/trust">
            <h2>Security lane</h2>
            <p>Aegis / cybersecurity posture for safer operator habits.</p>
            <span>Open Trust →</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
