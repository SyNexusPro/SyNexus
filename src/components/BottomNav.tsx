import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `bottom-nav__link${isActive ? " is-active" : ""}`;

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <NavLink to="/" end className={linkClass}>
        <span className="bottom-nav__icon" aria-hidden>
          ◎
        </span>
        Feed
      </NavLink>
      <NavLink to="/hub" className={linkClass}>
        <span className="bottom-nav__icon" aria-hidden>
          ⧉
        </span>
        Hub
      </NavLink>
      <NavLink to="/pulse" className={linkClass}>
        <span className="bottom-nav__icon" aria-hidden>
          ∿
        </span>
        Pulse
      </NavLink>
    </nav>
  );
}
