import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SynexusBootSequence } from "./components/SynexusBootSequence";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SynexusBootSequence>
      <App />
    </SynexusBootSequence>
  </StrictMode>,
);
