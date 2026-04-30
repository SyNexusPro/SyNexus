# HiveMind — Go-live checklist

Use this before pointing a domain at production traffic.

## Environment and secrets

- [ ] Create production Supabase project and run `supabase/schema.sql` in the SQL editor.
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider (or `.env` for builds).
- [ ] Optional: `VITE_BIRDEYE_API_KEY`, `VITE_SOLANA_RPC_URL` for richer market data.
- [ ] Confirm `public/guardian-config.json` values are what you want for launch (tune thresholds without redeploying logic).

## Auth and data

- [ ] Sign up / sign in / sign out on the Pulse screen against production Supabase.
- [ ] Insert a test row into `token_reports` via the app (signed-in user).
- [ ] Confirm RLS: users only see their own reports; alerts and tracked tokens behave as intended.
- [ ] Verify watchlist create + add token end-to-end.

## Product flows

- [ ] Home feed loads; DexScreener shows as live or mock fallback in the Guardian banner.
- [ ] Token detail page loads for a known `token/:id` and shows error state for unknown ids.
- [ ] Report from a token card and from token detail; confirm Supabase row or local fallback when logged out.

## Legal and trust

- [ ] Add Terms of Service, Privacy Policy, and a clear risk disclaimer (not financial advice).
- [ ] Disclose sponsored or featured listings if you add them later.

## Operations

- [ ] Production build passes: `npm run build`.
- [ ] Enable HTTPS and a sane cache policy for `index.html` (short) vs assets (long).
- [ ] Add error monitoring (for example Sentry) and basic analytics.
- [ ] Document on-call: who rotates Supabase keys if leaked.

## Post-launch (first week)

- [ ] Watch Supabase auth and database usage vs free tier limits.
- [ ] Collect user feedback on Guardian false positives/negatives; adjust `guardian-config.json`.
