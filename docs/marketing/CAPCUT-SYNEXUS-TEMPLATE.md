# CapCut Template — SyNexus Launch Shorts

Use this alongside auto-rendered MP4s in `marketing-ai/output/launch/day-XX/`. Auto renders are post-ready; CapCut is for polish or manual variants.

## Canvas

| Setting | Value |
|---------|-------|
| Ratio | 9:16 (1080×1920) |
| Length | 15–22 seconds |
| FPS | 30 |

## Scene timeline

```
0:00–0:02  HOOK     — largest text, glitch optional
0:02–0:10  BUILD    — dashboard B-roll or problem story
0:10–0:18  PAYOFF   — verdict badge + synexus.pro
0:18–0:22  LOOP     — cliffhanger line (match script)
```

## Text layers

1. **Hook** — ALL CAPS, 72–96pt, white or `#39FF14` glow  
2. **Sub-hook** — 36pt, `#A0A0A0`, 2 lines max  
3. **Badge** — `AVOID · WATCH · OK` pill, green border  
4. **Watermark** — `synexus.pro` bottom center, 24pt, 60% opacity entire clip  

## Visual assets

| Day | Style |
|-----|-------|
| 1–2 | Glitch overlay on hook · dark UI · urgent tone |
| 3 | Fake Sentinel dashboard · scan animation |
| 4 | Slower cuts · founder story · less glitch |
| 5–7 | Mix winners · FOMO text · Telegram CTA |

Source files:
- Auto-rendered scenes: `output/launch/day-XX/scenes/{script-id}/`
- Syn-Bunny overlay: `output/launch/day-XX/syn-bunny.png`
- App screen record: synexus.pro Pulse scan (optional B-roll)

## Audio

- **Voice:** Match `VIDEO_TTS_VOICE` (default `en-US-AriaNeural`) or ElevenLabs export from `*-script.txt`
- **Music:** Low drone or dark ambient under hook only (−18 dB)
- **SFX:** Optional glitch hit at 0:00 and 0:02

## Export

- H.264 · 1080×1920 · 30fps  
- Filename: `{script-id}.mp4` (e.g. `d1-s1.mp4`)  
- Replace auto-render in day folder or keep as `-capcut.mp4` variant  

## Per-script workflow

1. Open `CAPCUT-BRIEF.txt` + `{id}-script.txt` for the day  
2. Import auto `{id}.mp4` as base OR rebuild from scene PNGs  
3. Align on-screen text to hook/build/payoff/loop sections  
4. Export → `npm run launch:blast -- --day N --slot S` to post  

## Signature formats (repeat winners)

1. **AI Detection** — dashboard scan + “SyNexus is watching…”  
2. **Exposed Scam** — storytelling + fear hook  
3. **Before It Happens** — prediction hook + chart tease  
4. **Founder Story** — slower VO + emotional build  

Mark winners: `npm run launch:winner -- --id d5-s3 --views=50000`
