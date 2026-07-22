# Go live now — SyNexus action plan

Do these in order. Each step unlocks the next.

## Today (≈1 hour)

### 1. Production env on Vercel

In **Vercel → Project → Settings → Environment Variables**, set:

| Variable | Required for |
|----------|----------------|
| `VITE_SUPABASE_URL` | Login, watchlists |
| `VITE_SUPABASE_ANON_KEY` | Login |
| `SUPABASE_SERVICE_ROLE_KEY` | `/analytics` dashboard |
| `STRIPE_SECRET_KEY` | Pro checkout |
| `STRIPE_WEBHOOK_SECRET` | Pro after payment |
| `SYNEXUS_OWNER_EMAIL` | Command code |
| `SYNEXUS_OWNER_PASSWORD` | Command code |
| `VITE_APP_ORIGIN` | `https://synexus.pro` |

Redeploy after saving.

### 2. Supabase SQL (one time)

In **Supabase → SQL Editor**, run in order:

1. `supabase/schema.sql`
2. `supabase/site_analytics.sql`
3. `supabase/security_events.sql` (optional)

**Auth redirects:** Authentication → URL configuration → add:

- `https://synexus.pro/pulse`
- `http://localhost:5173/pulse`

**Email verification:** Authentication → Providers → Email → enable **Confirm email**. New Operator accounts must verify before Pulse syncs watchlists or Pro status.

### 3. Verify locally

```powershell
npm run go-live:check
npm run build
```

Visit `https://synexus.pro` — scan BONK, tap **Share this scan**, open the link in an incognito window.

### 4. Unlock analytics

Pulse → **Command code** tab → enter owner ID/key → open `/analytics`.

---

## This week — daily rhythm

### Morning (10 min)

1. Screen-record or use a hype PNG → Short caption:
   > Should I buy $TICKER? Scan free → synexus.pro/?scan=TICKER
2. Post to **Telegram** (auto) + **YouTube** (auto if configured)
3. **Manual cross-post** same video to X/TikTok if API blocked

### Post remaining hype art (once each)

Only **3 of 10** panels are posted. Add PNGs to `marketing-ai/assets/hype-creatives/` then:

```powershell
cd marketing-ai
npm run hype:post -- --only=rise-above
npm run hype:post -- --only=ai-mode
```

Run `npm run hype:queue` to see what's left.

---

## Fix Meta (Facebook + Instagram Reels)

```powershell
cd marketing-ai
npm run meta:auth
```

Follow the browser flow. Add tokens to `.env` per script prompts.

Then re-run hype post — FB/IG will upload instead of export-only.

---

## Fix X (optional)

- **Paid API:** developer.x.com → enable posting tier, refresh keys in `.env`
- **Free path:** export caption + MP4 from `marketing-ai/output/hype-assets/` and post manually

---

## Google Play (parallel, not blocking)

When web + Telegram move for 1–2 weeks:

```powershell
npm run android:release
```

Upload AAB to Play Console **Internal testing**. See `LAUNCH_CHECKLIST.md`.

---

## What "working" looks like

| Signal | Where to check |
|--------|----------------|
| People visiting | `/analytics` → page views |
| People scanning | `/analytics` → token views |
| People signing up | `/analytics` → sign ups |
| Shorts driving traffic | YouTube Studio → links clicked |

---

## Share scan (viral loop)

After any scan, users tap **Share this scan**. Friends land on:

`https://synexus.pro/?scan=BONK`

Use this URL in every Short description.
