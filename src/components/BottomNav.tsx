import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTitanShell } from "../context/TitanShellContext";
import { useOpenTitanGate } from "../hooks/useOpenTitanGate";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { useTitanChatOpen } from "../hooks/useTitanChatOpen";
import { useTitanLoginOpen } from "../hooks/useTitanChatOpen";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `bottom-nav__link${isActive ? " is-active" : ""}`;

export function BottomNav() {
  const { t } = useTranslation();
  const { closeSheet } = useTitanShell();
  const openLoginGate = useOpenTitanGate();
  const openTitanChat = useOpenTitanChat();
  const { linked } = useOperatorAuth();
  const chatOpen = useTitanChatOpen();
  const loginOpen = useTitanLoginOpen();
  const loginActive = loginOpen;
  const titanActive = chatOpen;

  return (
    <nav className="bottom-nav" aria-label={t("nav.primary")}>
      <button
        type="button"
        className={`bottom-nav__link${loginActive ? " is-active" : ""}`}
        onClick={openLoginGate}
        aria-current={loginActive ? "page" : undefined}
      >
        <span className="bottom-nav__icon bottom-nav__icon--login" aria-hidden>
          {linked ? "◉" : "⎔"}
        </span>
        {linked ? t("nav.account") : t("nav.login")}
      </button>
      <NavLink to="/" end className={linkClass} onClick={closeSheet}>
        <span className="bottom-nav__icon" aria-hidden>
          ◎
        </span>
        {t("nav.scan")}
      </NavLink>
      <NavLink to="/hub" className={linkClass} onClick={closeSheet}>
        <span className="bottom-nav__icon" aria-hidden>
          ⧉
        </span>
        {t("nav.hub")}
      </NavLink>
      <button
        type="button"
        className={`bottom-nav__link${titanActive ? " is-active" : ""}`}
        onClick={openTitanChat}
        aria-current={titanActive ? "page" : undefined}
      >
        <span className="bottom-nav__icon bottom-nav__icon--oracle" aria-hidden>
          ◉
        </span>
        {t("nav.titan")}
      </button>
    </nav>
  );
}
