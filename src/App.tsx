import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { GoogleAnalytics } from "./components/GoogleAnalytics";
import { NativePerformanceInit } from "./components/NativePerformanceInit";
import { SiteAnalyticsListener } from "./components/SiteAnalyticsListener";
import { TRADING_BUILD_ENABLED } from "./config/trading";
import { isNativeAndroid } from "./lib/bootExperience";
import { lazyWithRetry } from "./lib/lazyWithRetry";

/** Android: static home only — never load Matrix / ShouldIBuy / market feed chunk. */
const HomeFeed = lazyWithRetry(
  () =>
    isNativeAndroid()
      ? import("./pages/AndroidHomeStatic").then((m) => ({ default: m.AndroidHomeStatic }))
      : import("./pages/HomeFeed").then((m) => ({ default: m.HomeFeed })),
  "Home",
);
const EcosystemHub = lazyWithRetry(
  () => import("./pages/EcosystemHub").then((m) => ({ default: m.EcosystemHub })),
  "Hub",
);
const Pulse = lazyWithRetry(
  () => import("./pages/Pulse").then((m) => ({ default: m.Pulse })),
  "Pulse",
);
const Terms = lazy(() =>
  import("./pages/Terms").then((m) => ({ default: m.Terms })),
);
const Privacy = lazy(() =>
  import("./pages/Privacy").then((m) => ({ default: m.Privacy })),
);
const AccountDeletion = lazy(() =>
  import("./pages/AccountDeletion").then((m) => ({ default: m.AccountDeletion })),
);
const DataDeletion = lazy(() =>
  import("./pages/DataDeletion").then((m) => ({ default: m.DataDeletion })),
);
const LiquidityTreasury = lazy(() =>
  import("./pages/LiquidityTreasury").then((m) => ({ default: m.LiquidityTreasury })),
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
const Disclaimer = lazy(() => import("./pages/Disclaimer").then((m) => ({ default: m.Disclaimer })));
const Faq = lazy(() => import("./pages/Faq").then((m) => ({ default: m.Faq })));
const BlogIndex = lazy(() => import("./pages/Blog").then((m) => ({ default: m.BlogIndex })));
const BlogPostView = lazy(() => import("./pages/Blog").then((m) => ({ default: m.BlogPostView })));
const Markets = lazy(() => import("./pages/Markets").then((m) => ({ default: m.Markets })));
const NewsIntelligence = lazy(() =>
  import("./pages/NewsIntelligence").then((m) => ({ default: m.NewsIntelligence })),
);
const Automations = lazy(() =>
  import("./pages/Automations").then((m) => ({ default: m.Automations })),
);
const Watchlist = lazy(() => import("./pages/Watchlist").then((m) => ({ default: m.Watchlist })));
const SiteAnalytics = lazy(() =>
  import("./pages/SiteAnalytics").then((m) => ({ default: m.SiteAnalytics })),
);
const GodMode = lazy(() => import("./pages/GodMode").then((m) => ({ default: m.GodMode })));
const Pricing = lazy(() => import("./pages/Pricing").then((m) => ({ default: m.Pricing })));
const RefundPolicy = lazy(() =>
  import("./pages/RefundPolicy").then((m) => ({ default: m.RefundPolicy })),
);
const WalletComingSoon = lazy(() =>
  import("./pages/WalletComingSoon").then((m) => ({ default: m.WalletComingSoon })),
);
const InviteEarn = lazy(() => import("./pages/InviteEarn").then((m) => ({ default: m.InviteEarn })));
const Trade = TRADING_BUILD_ENABLED
  ? lazyWithRetry(() => import("./pages/Trade").then((m) => ({ default: m.Trade })), "Trade")
  : null;
const AffiliateReferralRedirect = lazy(() =>
  import("./pages/AffiliateReferralRedirect").then((m) => ({ default: m.AffiliateReferralRedirect })),
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
      <NativePerformanceInit />
      <GoogleAnalytics />
      <SiteAnalyticsListener />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomeFeed />} />
            <Route path="ref/:handle" element={<AffiliateReferralRedirect />} />
            <Route path="hub" element={<EcosystemHub />} />
            <Route path="about" element={<About />} />
            <Route path="trust" element={<Trust />} />
            <Route path="contact" element={<Contact />} />
            <Route path="faq" element={<Faq />} />
            <Route path="disclaimer" element={<Disclaimer />} />
            <Route path="pulse" element={<Pulse />} />
            <Route path="god" element={<GodMode />} />
            <Route path="invite" element={<InviteEarn />} />
            <Route path="invite/:code" element={<InviteEarn />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="refund-policy" element={<RefundPolicy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="account-deletion" element={<AccountDeletion />} />
            <Route path="delete-account" element={<Navigate to="/account-deletion" replace />} />
            <Route path="data-deletion" element={<DataDeletion />} />
            <Route path="request-data-deletion" element={<Navigate to="/data-deletion" replace />} />
            <Route path="wallet-terms" element={<WalletComingSoon />} />
            <Route path="wallet" element={<WalletComingSoon />} />
            <Route path="wallet/*" element={<WalletComingSoon />} />
            <Route path="liquidity-treasury" element={<LiquidityTreasury />} />
            <Route path="marketing-command" element={<MarketingCommand />} />
            <Route path="analytics" element={<SiteAnalytics />} />
            <Route path="blog" element={<BlogIndex />} />
            <Route path="blog/:slug" element={<BlogPostView />} />
            <Route path="markets" element={<Markets />} />
            <Route path="news" element={<NewsIntelligence />} />
            <Route path="business" element={<Navigate to="/hub" replace />} />
            <Route path="automations" element={<Automations />} />
            <Route path="learn" element={<Navigate to="/blog" replace />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="token/:tokenId" element={<TokenDetail />} />
            {Trade ? <Route path="trade" element={<Trade />} /> : null}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
