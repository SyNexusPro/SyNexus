# SyNexus 7-Day Viral Launch — Operator Guide

Automated content system aligned with the viral launch plan. **Brand: SyNexus only.** Telegram = home base.

## Quick start

```bash
cd marketing-ai
cp .env.example .env          # fill APP_ORIGIN, Telegram, YouTube, etc.
LAUNCH_START_DATE=2026-06-20  # Day 1 date (optional)

npm run launch:plan           # print full 7-day plan
npm run launch:write -- --day 1   # export 7 scripts + CapCut briefs
npm run launch:render -- --day 1  # render MP4s (green glow · female voice)
npm run launch:day -- --day 1     # write + render + 3 blast posts
npm run launch:watch              # auto-run current day every 24h
```

From repo root:

```bash
npm run launch:plan
npm run launch:day -- --day 1
npm run launch:watch
```

## What gets generated

For each day, output lands in `marketing-ai/output/launch/day-01/` (etc.):

| File | Purpose |
|------|---------|
| `manifest.json` | Day theme + script list |
| `d1-s1.json` | Full script metadata |
| `d1-s1-script.txt` | CapCut / ElevenLabs brief |
| `d1-s1.mp4` | Rendered Short |
| `d1-s1-tiktok.txt` | TikTok caption |
| `d1-s1-telegram.txt` | Telegram post |
| `CAPCUT-BRIEF.txt` | Day editing template |

**Total pre-written scripts: 48** (Day 6 auto-remixes top winners).

## Day-by-day

| Day | Theme | Videos |
|-----|-------|--------|
| 1 | Set the hook (launch) | 7 |
| 2 | Scandal + fear | 6 |
| 3 | AI authority | 6 |
| 4 | Founder story | 5 |
| 5 | Viral experiment | 12 |
| 6 | Double down (winners) | 10 variations |
| 7 | Community + FOMO | 6 |

## Mark winners (Day 6 fuel)

After Day 5, note your best performers:

```bash
npm run launch:winner -- --id d5-s3 --views=50000
npm run launch:winner -- --id d5-s1 --views=42000
npm run launch:render -- --day 6
```

Winners are stored in `output/launch/launch-state.json`.

## CapCut template (manual polish)

1. **Canvas:** 9:16 · 15–22s  
2. **Hook (0–2s):** Largest text — use `*-script.txt` hook line  
3. **Build (2–10s):** Dark UI / dashboard B-roll (auto-rendered MP4 or screen record synexus.pro)  
4. **Payoff (10–20s):** `AVOID · WATCH · OK` badge + synexus.pro  
5. **Loop:** End on "No one is ready for what comes next…"  
6. **Audio:** Match `VIDEO_TTS_VOICE` (Aria female) or replace with ElevenLabs  
7. **Effects:** Glitch on Day 1–2 · slower pacing Day 4  

Auto-rendered videos already include circuit-board art, fake Sentinel dashboard, and Syn-Bunny.

## Three engines (parallel)

1. **Content** — `launch:render` + optional CapCut pass  
2. **Viral test** — post volume Day 5 · log winners  
3. **Community** — every caption pushes Telegram  

## Telegram Day 1 launch post

```
🚀 SyNexus AI is now live

Should I buy this? Paste any Solana token → Avoid · Watch · OK

Try free: https://synexus.pro
Join for live drops: [your channel]
```

## Viral rules

- Post volume > perfection  
- Kill weak formats fast  
- Double down only on winners  
- Every clip must feel like something important is happening  

## Files (dev)

- `viralLaunchPlan.js` — day themes  
- `viralLaunchScripts.js` — all hooks/scripts  
- `viralLaunchRunner.js` — CLI  
- `viralLaunchRender.js` — MP4 pipeline  
- `launchState.js` — winners + posted state  
