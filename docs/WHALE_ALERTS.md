# Titan whale alerts (Pro)

## What shipped

- **Secure Titan:** `/api/titan/chat` derives PRO from Supabase session — client `plan` claims ignored. Server input guards + short response cache for fast crypto asks.
- **Whale pipeline:** Helius webhook → `whale_events` → Pro Web Push + in-app toast (4s poll). DexScreener volume-spike poll as fallback cron.
- **Titan:** Ask “any whale buys?” (Pro) for a live Leviathan brief. Mint paste resolves via DexScreener before LLM.

## Setup

1. Run SQL: `supabase/whale_alerts.sql` in Supabase SQL editor.
2. Generate VAPID:
   ```bash
   npm run vapid:generate
   ```
   Add to Vercel / `.env`:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT=mailto:thesynexus@synexus.pro`
3. Helius (true seconds latency):
   - Create enhanced-tx webhook → `https://www.synexus.pro/api/whale/webhook`
   - Auth header / `x-whale-secret` = `HELIUS_WEBHOOK_SECRET`
   - Optional: `WHALE_ALERT_MIN_USD=10000`
4. Poll fallback:
   - `WHALE_TRACK_MINTS=mint1,mint2,...`
   - `WHALE_POLL_SECRET` or `CRON_SECRET` (recommended in prod)
   - Vercel cron hits `/api/whale/poll` every minute

5. Ensure `SUPABASE_SERVICE_ROLE_KEY` is a real JWT or `sb_secret_` key (admin writes).

## Pro UX

Signed-in Pro users get toast alerts automatically; browser will prompt for notification permission once.
