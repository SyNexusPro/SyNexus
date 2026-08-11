import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TitanShellProvider } from "../context/TitanShellContext";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { BottomNav } from "./BottomNav";
import { UIModeToggle } from "./UIModeToggle";
import { TitanSheet } from "./TitanSheet";
import { ProDemoBanner } from "./ProDemoBanner";
import { BeginnerModeCoach } from "./BeginnerModeCoach";
import { WhaleAlertToaster } from "./WhaleAlertToaster";
import { LanguagePicker } from "./LanguagePicker";
import { SYNEXUS_VAULT_PATH, SYNEXUS_VAULT_PRODUCT_NAME } from "../config/walletComingSoon";

export function AppShell() {
  const { t } = useTranslation();
  const { isSimple } = useSynexusUIMode();
  const isHome = useLocation().pathname === "/";

  return (
    <TitanShellProvider>
      <div
        className={`app-shell${isSimple ? " app-shell--easy" : " app-shell--advanced"}${isHome ? " app-shell--home" : ""}`}
      >
        {!isHome ? <ProDemoBanner /> : null}
        <WhaleAlertToaster />
        <main className="app-main">
          {!isHome ? (
            <>
              <div className="app-mode-bar">
                <UIModeToggle />
              </div>
              <BeginnerModeCoach />
            </>
          ) : null}
          <RouteErrorBoundary label="page">
            <Outlet />
          </RouteErrorBoundary>
        </main>
        <TitanSheet />
        {isHome ? null : (
          <footer className="app-footer">
            <Link className="app-footer__link" to="/about">
              {t("footer.about")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/trust">
              {t("footer.trust")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/contact">
              {t("footer.contact")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/hub">
              {t("footer.hub")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/faq">
              {t("footer.faq")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/pricing">
              {t("footer.pricing")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/blog">
              {t("footer.blog")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/disclaimer">
              {t("footer.disclaimer")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/terms">
              {t("footer.terms")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/privacy">
              {t("footer.privacy")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/data-deletion">
              {t("footer.deleteData")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/account-deletion">
              {t("footer.deleteAccount")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to="/refund-policy">
              {t("footer.refunds")}
            </Link>
            <span className="app-footer__sep" aria-hidden>
              ·
            </span>
            <Link className="app-footer__link" to={SYNEXUS_VAULT_PATH} title={SYNEXUS_VAULT_PRODUCT_NAME}>
              {SYNEXUS_VAULT_PRODUCT_NAME}
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
        )}
        <div className="lang-picker-dock" aria-label="Language">
          <LanguagePicker compact />
        </div>
        <BottomNav />
      </div>
    </TitanShellProvider>
  );
}
