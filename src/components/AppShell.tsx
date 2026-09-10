import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TitanShellProvider } from "../context/TitanShellContext";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { useTitanChatOpen } from "../hooks/useTitanChatOpen";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { BottomNav } from "./BottomNav";
import { UIModeToggle } from "./UIModeToggle";
import { TitanSheet } from "./TitanSheet";
import { HeraWakeWordHost } from "./HeraWakeWordHost";
import { ProDemoBanner } from "./ProDemoBanner";
import { BeginnerModeCoach } from "./BeginnerModeCoach";
import { WhaleAlertToaster } from "./WhaleAlertToaster";
import { TitanLiveAlerts } from "./TitanLiveAlerts";
import { LanguagePicker } from "./LanguagePicker";
import { OnboardingTour } from "./OnboardingTour";
import { SYNEXUS_VAULT_PATH, SYNEXUS_VAULT_PRODUCT_NAME } from "../config/walletComingSoon";
import { isTradingEnabled } from "../config/trading";

export function AppShell() {
  return (
    <TitanShellProvider>
      <AppShellFrame />
    </TitanShellProvider>
  );
}

function AppShellFrame() {
  const { t } = useTranslation();
  const { isSimple } = useSynexusUIMode();
  const isHome = useLocation().pathname === "/";
  const heraOpen = useTitanChatOpen();
  const trading = isTradingEnabled();

  return (
    <div
      className={`app-shell${isSimple ? " app-shell--easy" : " app-shell--advanced"}${isHome ? " app-shell--home" : ""}${heraOpen ? " app-shell--hera" : ""}`}
    >
      <div className="app-shell__dashboard">
        {!isHome ? <ProDemoBanner /> : null}
        <WhaleAlertToaster />
        <TitanLiveAlerts />
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
            {trading ? (
              <>
                <span className="app-footer__sep" aria-hidden>
                  ·
                </span>
                <Link className="app-footer__link" to="/trade">
                  {t("footer.trade")}
                </Link>
              </>
            ) : null}
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
            <Link className="app-footer__link" to="/invite">
              Invite and Earn
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
      </div>
      <TitanSheet />
      <HeraWakeWordHost />
      <BottomNav />
      <OnboardingTour />
    </div>
  );
}
