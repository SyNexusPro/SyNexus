import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden>
            ⬡
          </span>
          <div>
            <p className="app-header__title">HiveMind</p>
            <p className="app-header__domain">
              <a
                href="https://hivemind.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                hivemind.ai
              </a>
            </p>
            <p className="app-header__subtitle">
              HiveMind scans market activity, liquidity changes, and risk signals so
              traders can move smarter.
            </p>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
