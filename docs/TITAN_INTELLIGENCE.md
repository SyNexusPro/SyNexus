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
| `POST /api/titan/chat` | Streaming Titan + discovery charter + `research[]` |
| `POST /api/titan/event` | Insert event → classify → fan out premium alerts |
| `GET/POST /api/cron/titan-daily` | Daily Intelligence Brief → Pro digests (13:00 UTC) |
| `GET/POST /api/cron/titan-discovery` | Scan emerging Solana assets → `DISCOVERY_SCORE` events (every 15m) |
| `GET/POST /api/cron/titan-launch-watch` | Public launch + social leads → `LAUNCH_WATCH` events (every 2m) |
| `GET /api/hera/launch-watch` | Live snapshot for Hera (pump.fun, Gecko new pools, Dex profiles, Reddit, news, optional X) |

Secrets (optional but recommended):
- `TITAN_EVENT_SECRET` / `CRON_SECRET`
- `VAPID_*` for Web Push
- LLM keys already used by Titan chat
- `X_BEARER_TOKEN` for X/Twitter recent-search (optional; other launch feeds work without it)

## 3. Discovery evaluation

Titan continuously looks for emerging assets, meme coins, launches, unusual DEX activity, whale accumulation, liquidity changes, security incidents, and news momentum — **never a single source**.

For each asset Titan assigns:

| Axis | Range |
|------|--------|
| DISCOVERY SCORE | 0–100 |
| RISK SCORE | 0–100 |
| MOMENTUM SCORE | 0–100 |
| CONFIDENCE | low / medium / high |

Rules:
- Hype alone is never quality evidence
- Separate **confirmed facts** from **speculation**
- Explain **why** something is moving
- High-risk tokens stay **reportable** (labeled, not suppressed)
- Prioritize unusual combos (liq↑ + vol↑ + new holders / whale prints / listings)
- Anti-spam: insignificant tapes are not emitted

Implementation:
- Client: `src/lib/titanDiscovery.ts` (Token → scores; chat + Token Detail scorecard)
- Server: `lib/server/titan/discoveryEval.ts` + `discoveryScan.ts` (DexScreener boosts/profiles → events)
- Events: `type = DISCOVERY_SCORE` with axes in `metadata`

## 3b. Launch watch (Hera)

Hera scans **public** launch and social surfaces so she can answer “what’s launching” / “anyone posting a CA” from a live snapshot — not training memory.

Sources:
- pump.fun newest coins (includes attached X / Telegram / website)
- GeckoTerminal new Solana pools
- DexScreener latest token profiles
- Reddit: r/CryptoMoonShots, r/solana, r/pumpfun, r/SatoshiStreetBets (launch-keyword posts)
- CryptoCompare headlines matching launch language
- Optional X recent search when `X_BEARER_TOKEN` is set

She does **not** read private DMs, closed Discords, or locked Telegram groups.

Chat injects `LIVE LAUNCH WATCH` when the question matches launch/social intent. Cron persists notable leads as `titan_events` type `LAUNCH_WATCH` (anti-spam: not every pump.fun tick).

## 4. Whale → Titan

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

## 5. Live alerts in-app

`TitanLiveAlerts` subscribes to `titan_notifications` Realtime for the signed-in Pro user.

## 6. Research in chat

Client sends discovery packets as `research: [...]` on `/api/titan/chat`. Titan treats them as **CURRENT RESEARCH DATA** and must lead with discovery / risk / momentum / confidence when present.
