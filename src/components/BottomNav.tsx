import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTitanShell } from "../context/TitanShellContext";
import { useOpenTitanGate } from "../hooks/useOpenTitanGate";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { useTitanLoginOpen } from "../hooks/useTitanChatOpen";
import { isTradingEnabled } from "../config/trading";
import { HeraWakeWordControl } from "./HeraWakeWordControl";
import { useHeraWakeWordSetting } from "../hooks/useHeraWakeWordSetting";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `bottom-nav__link${isActive ? " is-active" : ""}`;

export function BottomNav() {
  const { t } = useTranslation();
  const { closeSheet } = useTitanShell();
  const openLoginGate = useOpenTitanGate();
  const { linked } = useOperatorAuth();
  const loginOpen = useTitanLoginOpen();
  const loginActive = loginOpen;
  const trading = isTradingEnabled();
  const { docked: listenDocked } = useHeraWakeWordSetting();

  return (
    <nav className={`bottom-nav${trading ? " bottom-nav--trade" : ""}`} aria-label={t("nav.primary")}>
      <button
        type="button"
        className={`bottom-nav__link${loginActive ? " is-active" : ""}`}
        data-tour="nav-login"
        onClick={openLoginGate}
        aria-current={loginActive ? "page" : undefined}
      >
        <span className="bottom-nav__icon bottom-nav__icon--login" aria-hidden>
          {linked ? "◉" : "⎔"}
        </span>
        {linked ? t("nav.account") : t("nav.login")}
      </button>
      <NavLink to="/" end className={linkClass} onClick={closeSheet} data-tour="nav-scan">
        <span className="bottom-nav__icon" aria-hidden>
          ◎
        </span>
        {t("nav.scan")}
      </NavLink>
      <NavLink to="/hub" className={linkClass} onClick={closeSheet} data-tour="nav-hub">
        <span className="bottom-nav__icon" aria-hidden>
          ⧉
        </span>
        {t("nav.hub")}
      </NavLink>
      {trading ? (
        <NavLink to="/trade" className={linkClass} onClick={closeSheet}>
          <span className="bottom-nav__icon" aria-hidden>
            ⇄
          </span>
          {t("nav.trade")}
        </NavLink>
      ) : null}
      {listenDocked ? null : <HeraWakeWordControl />}
    </nav>
  );
}
