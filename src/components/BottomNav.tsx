import { NavLink, useLocation } from "react-router-dom";
import { useOpenTitanGate } from "../hooks/useOpenTitanGate";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `bottom-nav__link${isActive ? " is-active" : ""}`;

export function BottomNav() {
  const { isSimple } = useSynexusUIMode();
  const location = useLocation();
  const openTitanGate = useOpenTitanGate();
  const titanActive = location.pathname === "/pulse";

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <NavLink to="/" end className={linkClass}>
        <span className="bottom-nav__icon" aria-hidden>
          {isSimple ? "◎" : "⌂"}
        </span>
        {isSimple ? "Scan" : "Feed"}
      </NavLink>
      <NavLink to="/hub" className={linkClass}>
        <span className="bottom-nav__icon" aria-hidden>
          ⧉
        </span>
        Hub
      </NavLink>
      <button
        type="button"
        className={`bottom-nav__link${titanActive ? " is-active" : ""}`}
        onClick={openTitanGate}
      >
        <span className="bottom-nav__icon bottom-nav__icon--oracle" aria-hidden>
          {isSimple ? "◉" : "∿"}
        </span>
        {isSimple ? "Titan" : "Sentinels"}
      </button>
    </nav>
  );
}
