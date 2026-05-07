import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const HomeFeed = lazy(() =>
  import("./pages/HomeFeed").then((m) => ({ default: m.HomeFeed })),
);
const EcosystemHub = lazy(() =>
  import("./pages/EcosystemHub").then((m) => ({ default: m.EcosystemHub })),
);
const Pulse = lazy(() =>
  import("./pages/Pulse").then((m) => ({ default: m.Pulse })),
);
const Terms = lazy(() =>
  import("./pages/Terms").then((m) => ({ default: m.Terms })),
);
const TokenDetail = lazy(() =>
  import("./pages/TokenDetail").then((m) => ({ default: m.TokenDetail })),
);

function RouteFallback() {
  return (
    <div className="detail-loading" role="status" aria-live="polite">
      <p className="detail-loading__pulse">Loading…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomeFeed />} />
            <Route path="hub" element={<EcosystemHub />} />
            <Route path="pulse" element={<Pulse />} />
            <Route path="terms" element={<Terms />} />
            <Route path="token/:tokenId" element={<TokenDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
