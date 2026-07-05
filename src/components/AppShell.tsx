import { Link, Outlet } from "react-router-dom";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { BottomNav } from "./BottomNav";
import { UIModeToggle } from "./UIModeToggle";
import { OracleSupremePresence } from "./OracleSupremePresence";
import { ProDemoBanner } from "./ProDemoBanner";
import { BeginnerModeCoach } from "./BeginnerModeCoach";

export function AppShell() {
  const { isSimple } = useSynexusUIMode();

  return (
    <div className={`app-shell${isSimple ? " app-shell--easy" : " app-shell--advanced"}`}>
      <ProDemoBanner />
      <main className="app-main">
        <div className="app-mode-bar">
          <UIModeToggle />
        </div>
        <BeginnerModeCoach />
        <Outlet />
      </main>
      <OracleSupremePresence />
      <footer className="app-footer">
        <Link className="app-footer__link" to="/about">
          About
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/trust">
          Trust
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/contact">
          Contact
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/hub">
          Hub
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/faq">
          FAQ
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/blog">
          Journal
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/disclaimer">
          Disclaimer
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/terms">
          Terms
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link className="app-footer__link" to="/privacy">
          Privacy
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link
          className="app-footer__link"
          to="/liquidity-treasury"
          title="Synexus Coin Liquidity Treasury"
        >
          Liquidity Treasury
        </Link>
      </footer>
      <BottomNav />
    </div>
  );
}
