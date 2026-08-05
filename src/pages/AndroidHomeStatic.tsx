import { Link } from "react-router-dom";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";

/**
 * Android-only home: no canvas, overlays, market polls, or heavy tool panels.
 * Flat black + static links — first paint stays responsive in WebView.
 */
const LINKS: { id: string; title: string; body: string; to?: string; titan?: boolean }[] = [
  { id: "scan", title: "Scan", body: "Check a token before you buy.", to: "/pulse" },
  { id: "markets", title: "Markets", body: "Prices and movers.", to: "/markets" },
  { id: "titan", title: "AI Assistant", body: "Ask Titan.", titan: true },
  { id: "security", title: "Cybersecurity", body: "Risk checks and alerts.", to: "/pulse" },
  { id: "news", title: "News", body: "Market headlines.", to: "/news" },
  { id: "hub", title: "Hub", body: "Tools and ecosystem.", to: "/hub" },
];

export function AndroidHomeStatic() {
  const openTitanChat = useOpenTitanChat();

  return (
    <div className="page page--android-static" aria-label="SyNexus home">
      <header className="android-home__brand">
        <img
          className="android-home__mark"
          src="/synexus-brand-mark.png"
          alt="SyNexus"
          width={360}
          height={120}
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        <h1 className="android-home__headline">One AI. Unlimited Intelligence.</h1>
        <p className="android-home__lede">Markets. Business. Security. Automation.</p>
      </header>

      <nav className="android-home__grid" aria-label="Features">
        {LINKS.map((item) =>
          item.titan ? (
            <button
              key={item.id}
              type="button"
              className="android-home__card"
              onClick={openTitanChat}
            >
              <span className="android-home__card-title">{item.title}</span>
              <span className="android-home__card-body">{item.body}</span>
            </button>
          ) : (
            <Link key={item.id} className="android-home__card" to={item.to ?? "/"}>
              <span className="android-home__card-title">{item.title}</span>
              <span className="android-home__card-body">{item.body}</span>
            </Link>
          ),
        )}
      </nav>

      <p className="android-home__trust">
        Non-custodial — SyNexus never holds your keys.{" "}
        <Link to="/trust">Trust</Link>
      </p>
    </div>
  );
}
