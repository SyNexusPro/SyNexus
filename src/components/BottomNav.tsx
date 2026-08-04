import { NavLink } from "react-router-dom";
import { useTitanShell } from "../context/TitanShellContext";
import { useOpenTitanGate } from "../hooks/useOpenTitanGate";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { useTitanChatOpen } from "../hooks/useTitanChatOpen";
import { useTitanLoginOpen } from "../hooks/useTitanChatOpen";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `bottom-nav__link${isActive ? " is-active" : ""}`;

export function BottomNav() {
  const { closeSheet } = useTitanShell();
  const openLoginGate = useOpenTitanGate();
  const openTitanChat = useOpenTitanChat();
  const { linked } = useOperatorAuth();
  const chatOpen = useTitanChatOpen();
  const loginOpen = useTitanLoginOpen();
  const loginActive = loginOpen;
  const titanActive = chatOpen;

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button
        type="button"
        className={`bottom-nav__link${loginActive ? " is-active" : ""}`}
        onClick={openLoginGate}
        aria-current={loginActive ? "page" : undefined}
      >
        <span className="bottom-nav__icon bottom-nav__icon--login" aria-hidden>
          {linked ? "◉" : "⎔"}
        </span>
        {linked ? "Account" : "Login"}
      </button>
      <NavLink to="/" end className={linkClass} onClick={closeSheet}>
        <span className="bottom-nav__icon" aria-hidden>
          ◎
        </span>
        Scan
      </NavLink>
      <NavLink to="/hub" className={linkClass} onClick={closeSheet}>
        <span className="bottom-nav__icon" aria-hidden>
          ⧉
        </span>
        Hub
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
        Titan
      </button>
    </nav>
  );
}
