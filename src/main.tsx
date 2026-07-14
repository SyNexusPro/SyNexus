import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SynexusBootSequence } from "./components/SynexusBootSequence";
import { initSecurityBot } from "./lib/securityBot";
import { refreshOwnerAccess } from "./lib/ownerAccess";
import { clearExpiredProDemo, restoreActiveProTrialGrant } from "./lib/proDemo";
import "./index.css";

initSecurityBot();
clearExpiredProDemo();
restoreActiveProTrialGrant();
void refreshOwnerAccess();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <SynexusBootSequence>
        <App />
      </SynexusBootSequence>
    </ErrorBoundary>
  </StrictMode>,
);
