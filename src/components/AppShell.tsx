import { Link, Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { UIModeToggle } from "./UIModeToggle";
import { OracleSupremePresence } from "./OracleSupremePresence";

export function AppShell() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <div className="app-mode-bar">
          <UIModeToggle />
        </div>
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
      </footer>
      <BottomNav />
    </div>
  );
}
