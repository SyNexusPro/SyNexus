# Titan intelligence engine

## 1. Run SQL

In Supabase SQL editor, run:

`supabase/titan_intelligence.sql`

This adds:
- `profiles.subscription_status` (`active` = premium alerts), `notifications_enabled`, `instant_alerts`, `daily_digest`
- `titan_events`, `titan_notifications`
- RLS + Realtime publication for live in-app alerts

Paid users should have **`subscription_status = 'active'`** (synced automatically when Square sets `paid_plan = PRO`).

## 2. APIs

| Path | Role |
|------|------|
| `POST /api/titan/chat` | Streaming Titan (existing) + intelligence charter + optional `research[]` |
| `POST /api/titan/event` | Insert event → classify → fan out premium alerts |
| `GET/POST /api/cron/titan-daily` | Daily Intelligence Brief → Pro digests (13:00 UTC) |

Secrets (optional but recommended):
- `TITAN_EVENT_SECRET` / `CRON_SECRET`
- `VAPID_*` for Web Push
- LLM keys already used by Titan chat

## 3. Whale → Titan

Helius / whale poll already writes `whale_events`. Large buys also insert `titan_events` (`WHALE_BUY`) and call `sendPremiumAlert` when severity is `high`/`critical`.

Example manual event:

```bash
curl -X POST https://www.synexus.pro/api/titan/event \
  -H "Content-Type: application/json" \
  -H "x-titan-secret: $TITAN_EVENT_SECRET" \
  -d '{
    "type": "WHALE_BUY",
    "title": "Large SOL purchase detected",
    "summary": "A tracked wallet purchased approximately $684,230 of SOL.",
    "symbol": "SOL",
    "severity": "high",
    "metadata": { "usdValue": 684230, "wallet": "…" }
  }'
```

## 4. Live alerts in-app

`TitanLiveAlerts` subscribes to `titan_notifications` Realtime for the signed-in Pro user.

## 5. Research in chat

Client may send `research: [...]` on `/api/titan/chat` (Helius / Birdeye / news / DB packets). Titan treats it as **CURRENT RESEARCH DATA** before concluding.
