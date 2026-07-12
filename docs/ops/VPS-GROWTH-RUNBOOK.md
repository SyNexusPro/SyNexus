# Synexus Growth Engine — VPS Runbook

Run the autonomous growth loop 24/7 on a cheap VPS (~$5–7/mo). Stripe Pro payments auto-log to Supabase via the Vercel webhook; the VPS runs content (blog + video blast).

## Architecture

```
Stripe payment → Vercel /api/stripe/webhook → Supabase treasury_revenue
                                                      ↓
VPS growth:watch ← reads treasury via npm run treasury:status (merges Supabase + local)
     ↓
Blog + Telegram + X + … (marketing-ai/.env)
```

## 1. Pick a VPS

| Provider | Plan | Cost |
|----------|------|------|
| Hetzner CX22 | 2 vCPU · 4 GB | ~€4/mo |
| DigitalOcean Basic | 1 vCPU · 1 GB | ~$6/mo |
| Vultr Cloud Compute | 1 vCPU · 1 GB | ~$6/mo |

**OS:** Ubuntu 22.04 or 24.04 LTS.

## 2. One-time server setup

SSH in as root, then run (replace `YOUR_GITHUB_REPO`):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git ffmpeg

adduser --disabled-password --gecos "" synexus
mkdir -p /opt/synexus
chown synexus:synexus /opt/synexus
```

As `synexus`:

```bash
sudo -u synexus -i
cd /opt/synexus
git clone https://github.com/YOUR_GITHUB_REPO/SyNexus-app.git app
cd app
npm install
npm install --prefix marketing-ai
```

## 3. Environment files

**`/opt/synexus/app/marketing-ai/.env`** — copy from your machine (Telegram, X, etc.):

```env
APP_ORIGIN=https://synexus.pro
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=-100...
POST_HOURS=9,14,20
LAUNCH_START_DATE=2026-06-28
```

**Root `.env`** — only needed on VPS if you want `treasury:status` to merge Supabase:

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only, never commit
```

## 4. Install systemd service

From the repo on the VPS:

```bash
sudo bash marketing-ai/ops/install-growth-vps.sh
```

This installs `synexus-growth.service`, enables it on boot, and starts `npm run growth:watch`.

Useful commands:

```bash
sudo systemctl status synexus-growth
sudo journalctl -u synexus-growth -f
sudo systemctl restart synexus-growth
```

## 5. Stripe webhook (Vercel — one time)

1. **Supabase:** run the `treasury_revenue` block from `supabase/schema.sql` in the SQL editor.

2. **Vercel env vars** (Production):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID_PRO`
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Stripe Dashboard → Developers → Webhooks → Add endpoint:**
   - URL: `https://synexus.pro/api/stripe/webhook`
   - Events:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `customer.subscription.deleted`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET` on Vercel → redeploy.

4. **Test locally** (optional):

```bash
stripe listen --forward-to localhost:5173/api/stripe/webhook
stripe trigger invoice.payment_succeeded
npm run treasury:status
```

## 6. Verify end-to-end

On VPS:

```bash
cd /opt/synexus/app
npm run growth:status
npm run growth:once
```

After a real or test Pro payment:

```bash
npm run treasury:status
```

You should see `Total logged` increase and `(includes Stripe auto-log from Supabase)` when entries sync.

## 7. Updates

```bash
cd /opt/synexus/app
git pull
npm install
npm install --prefix marketing-ai
sudo systemctl restart synexus-growth
```

Optional weekly cron as `synexus`:

```cron
0 4 * * 0 cd /opt/synexus/app && git pull && npm install --prefix marketing-ai && sudo systemctl restart synexus-growth
```

## 8. Security checklist

- [ ] `marketing-ai/.env` mode `600`, owned by `synexus`
- [ ] Never put `SUPABASE_SERVICE_ROLE_KEY` in client or marketing posts
- [ ] UFW: `ufw allow OpenSSH && ufw enable` (no public ports needed for outbound-only bot)
- [ ] Rotate Telegram bot token if ever exposed

## Cost summary (6-month growth phase)

| Item | ~Monthly |
|------|----------|
| VPS | $5–7 |
| Vercel (app) | $0 hobby |
| Supabase | $0 free tier |
| **Total** | **~$6** |

Revenue from Pro subs and fees feeds the treasury pot automatically — 100% reinvest per `treasuryPolicy.json`.
