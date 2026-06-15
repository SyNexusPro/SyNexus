# Synexus — Go-live checklist

Use this before production traffic and Google Play submission.

## Environment and secrets

- [ ] Create production Supabase project and run `supabase/schema.sql` in the SQL editor.
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider (or `.env` for builds).
- [ ] **Mobile builds:** env vars are baked in at `npm run build` time — ensure `.env` is present locally or in CI before `npm run android:bundle`.
- [ ] Optional: `VITE_BIRDEYE_API_KEY`, `VITE_SOLANA_RPC_URL` for richer market data.
- [ ] Confirm `public/guardian-config.json` values are what you want for launch.

## Auth and data (Operator link)

- [ ] Sign up / sign in / sign out on **Pulse → Operator link** against production Supabase.
- [ ] Confirm watchlist, alerts, and Pro plan sync after reconnect on a second device.
- [ ] Insert a test row into `token_reports` via the app (signed-in user).
- [ ] Confirm RLS: users only see their own reports; alerts and tracked tokens behave as intended.

## Product flows

- [ ] Home feed loads; DexScreener shows as live or mock fallback.
- [ ] Token detail page loads for a known `token/:id` and shows error state for unknown ids.
- [ ] Report from a token card and from token detail.
- [ ] Oracle Supreme chat, voice bar, and Sentinels live intel on Pulse.

## Legal and trust

- [ ] Replace placeholder operator entity in Terms/Privacy with your registered legal name and support email (after counsel review).
- [ ] Set `VITE_SUPPORT_EMAIL` for Contact page and bug-report mailto handoff.
- [ ] Terms (`/terms`), Privacy (`/privacy`), About (`/about`), Trust (`/trust`), and Contact (`/contact`) linked from app footer — required for Google Play.
- [ ] Clear risk disclaimer: not financial advice; AI/Sentinel outputs are informational only.
- [ ] Export **phone screenshots** from `/about` or `/trust` preview frames, or capture on a physical device (≥ 2 required for Play listing).

## Google Play — one-time setup

- [ ] Create a [Google Play Console](https://play.google.com/console) developer account ($25 one-time).
- [ ] Create app **Synexus** with package name `com.synexus.app` (must match `capacitor.config.ts`).
- [ ] Generate upload keystore (see `android/keystore.properties.example`); copy to `android/keystore.properties` and **back up the `.jks` offline**.
- [ ] Enable **Play App Signing** in Console (Google holds the app signing key; you upload with the upload key).

## Google Play — build and upload

```bash
# 1. Icons from Synexus symbol (after logo changes)
npm run android:icons

# 2. Production web build + sync + signed AAB (requires keystore.properties)
npm run android:bundle
```

- [ ] Output AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] Upload AAB to **Internal testing** track first; install on a physical device.
- [ ] Bump `versionCode` in `android/app/build.gradle` before every new upload (Play rejects duplicates).

## Google Play — store listing (required before production)

| Asset | Spec |
|-------|------|
| App name | Synexus |
| Short description | ≤ 80 chars |
| Full description | Features, Sentinels, Oracle Supreme, Pro — no guaranteed returns |
| App icon | 512×512 PNG (use `public/synexus-symbol.png` or export from icons script) |
| Feature graphic | 1024×500 PNG |
| Phone screenshots | ≥ 2, 16:9 or 9:16 |
| Privacy policy URL | Public HTTPS URL to `/privacy` on your production domain |
| Category | Finance (or Tools — confirm with counsel) |

## Google Play — policy forms

- [ ] **Data safety:** declare email (account), usage/diagnostics, payment metadata (Stripe); link Privacy Policy.
- [ ] **Financial features:** declare crypto/token information app; not a wallet or exchange.
- [ ] **Target audience:** 18+ (matches Terms).
- [ ] **Ads:** No if you do not show third-party ads.
- [ ] **Content rating:** complete IARC questionnaire (likely low maturity; crypto info may add flags).

## Operations

- [ ] Production build passes: `npm run build`.
- [ ] Enable HTTPS on web; short cache for `index.html`, long cache for hashed assets.
- [ ] Error monitoring (e.g. Sentry) and basic analytics.
- [ ] Document key rotation if Supabase or Stripe secrets leak.

## Post-launch (first week)

- [ ] Watch Supabase auth and database usage vs free tier limits.
- [ ] Monitor Play Console vitals (crashes, ANRs).
- [ ] Tune `guardian-config.json` from Sentinel false positive/negative feedback.

## Suggested store copy (draft — edit before submit)

**Short:** Safer token discovery with Sentinels, Oracle Supreme briefings, and live risk scans.

**Full (excerpt):** Synexus helps you explore tokens with AI-powered Sentinels (Aegis, Pulse, Titan, Cipher), Oracle Supreme daily briefings, watchlists, and community reports. Not financial advice. Synexus Pro unlocks deeper lanes and voice briefings. Subscriptions billed through Google Play or web per your purchase path.
