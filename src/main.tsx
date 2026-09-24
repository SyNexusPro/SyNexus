import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SynexusBootSequence } from "./components/SynexusBootSequence";
import { initSecurityBot } from "./lib/securityBot";
import { refreshOwnerAccess } from "./lib/ownerAccess";
import { restoreAlwaysOnPlayReviewSession } from "./lib/googlePlayReviewAccess";
import { clearExpiredProDemo, restoreActiveProTrialGrant } from "./lib/proDemo";
import { markNativePerformanceMode } from "./lib/nativePerformance";
import { realtime } from "./lib/realtime/RealtimeManager";
import { migrateLegacyStorageKeys } from "./lib/legacyStorageMigrate";
import "./i18n";
import "./index.css";

migrateLegacyStorageKeys();
initSecurityBot();
clearExpiredProDemo();
restoreActiveProTrialGrant();
void refreshOwnerAccess();
void restoreAlwaysOnPlayReviewSession();
markNativePerformanceMode();
realtime.start();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <SynexusBootSequence>
          <App />
          <Analytics />
        </SynexusBootSequence>
      </ErrorBoundary>
    </StrictMode>,
  );
}
