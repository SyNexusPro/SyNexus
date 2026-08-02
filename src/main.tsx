import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SynexusBootSequence } from "./components/SynexusBootSequence";
import { initSecurityBot } from "./lib/securityBot";
import { refreshOwnerAccess } from "./lib/ownerAccess";
import { clearExpiredProDemo, restoreActiveProTrialGrant } from "./lib/proDemo";
import { markNativePerformanceMode } from "./lib/nativePerformance";
import { migrateLegacyStorageKeys } from "./lib/legacyStorageMigrate";
import "./index.css";

migrateLegacyStorageKeys();
initSecurityBot();
clearExpiredProDemo();
restoreActiveProTrialGrant();
void refreshOwnerAccess();
markNativePerformanceMode();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <SynexusBootSequence>
        <App />
        <Analytics />
      </SynexusBootSequence>
    </ErrorBoundary>
  </StrictMode>,
);
