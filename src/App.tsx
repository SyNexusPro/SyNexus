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
const Privacy = lazy(() =>
  import("./pages/Privacy").then((m) => ({ default: m.Privacy })),
);
const TokenDetail = lazy(() =>
  import("./pages/TokenDetail").then((m) => ({ default: m.TokenDetail })),
);
const MarketingCommand = lazy(() =>
  import("./pages/MarketingCommand").then((m) => ({ default: m.MarketingCommand })),
);
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const Trust = lazy(() => import("./pages/Trust").then((m) => ({ default: m.Trust })));
const Contact = lazy(() => import("./pages/Contact").then((m) => ({ default: m.Contact })));

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
            <Route path="about" element={<About />} />
            <Route path="trust" element={<Trust />} />
            <Route path="contact" element={<Contact />} />
            <Route path="pulse" element={<Pulse />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="marketing-command" element={<MarketingCommand />} />
            <Route path="token/:tokenId" element={<TokenDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
