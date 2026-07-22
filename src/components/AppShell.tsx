import { Link, Outlet, useLocation } from "react-router-dom";
import { TitanShellProvider } from "../context/TitanShellContext";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { BottomNav } from "./BottomNav";
import { UIModeToggle } from "./UIModeToggle";
import { TitanSheet } from "./TitanSheet";
import { ProDemoBanner } from "./ProDemoBanner";
import { BeginnerModeCoach } from "./BeginnerModeCoach";

export function AppShell() {
  const { isSimple } = useSynexusUIMode();
  const isHome = useLocation().pathname === "/";

  return (
    <TitanShellProvider>
    <div className={`app-shell${isSimple ? " app-shell--easy" : " app-shell--advanced"}${isHome ? " app-shell--home" : ""}`}>
      {!isHome ? <ProDemoBanner /> : null}
      <main className="app-main">
        {!isHome ? (
          <>
            <div className="app-mode-bar">
              <UIModeToggle />
            </div>
            <BeginnerModeCoach />
          </>
        ) : null}
        <Outlet />
      </main>
      <TitanSheet />
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
        <Link className="app-footer__link" to="/pricing">
          Pricing
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
        <Link className="app-footer__link" to="/refund-policy">
          Refunds
        </Link>
        <span className="app-footer__sep" aria-hidden>
          ·
        </span>
        <Link
          className="app-footer__link"
          to="/liquidity-treasury"
          title="SyNexus Coin Liquidity Treasury"
        >
          Liquidity Treasury
        </Link>
      </footer>
      <BottomNav />
    </div>
    </TitanShellProvider>
  );
}
