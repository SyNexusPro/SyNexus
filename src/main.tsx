import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SynexusBootSequence } from "./components/SynexusBootSequence";
import { initSecurityBot } from "./lib/securityBot";
import "./index.css";

initSecurityBot();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <SynexusBootSequence>
        <App />
      </SynexusBootSequence>
    </ErrorBoundary>
  </StrictMode>,
);
