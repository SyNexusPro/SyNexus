import { NavLink } from "react-router-dom";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `bottom-nav__link${isActive ? " is-active" : ""}`;

export function BottomNav() {
  const { isSimple } = useSynexusUIMode();

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
      <NavLink to="/pulse" className={linkClass}>
        <span className="bottom-nav__icon" aria-hidden>
          {isSimple ? "◈" : "∿"}
        </span>
        {isSimple ? "Tools" : "Sentinels"}
      </NavLink>
    </nav>
  );
}
