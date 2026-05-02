import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <img className="app-header__logo" src="/hivemind-logo-art.png" alt="" aria-hidden />
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
