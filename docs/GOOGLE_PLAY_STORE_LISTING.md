# Google Play — store listing, Data safety, screenshots

Copy-paste reference for [Google Play Console](https://play.google.com/console).  
Build artifact: `android/app/build/outputs/bundle/release/app-release.aab`

See also: [GOOGLE_PLAY.md](./GOOGLE_PLAY.md) (build & sync), [LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md).

---

## Store listing fields

| Field | Value |
|-------|--------|
| **App name** | SyNexus |
| **Package** | `com.synexus.app` |
| **Category** | Finance |
| **Contact email** | thesynexus@synexus.pro |
| **Privacy policy** | https://www.synexus.pro/privacy |
| **Website** | https://www.synexus.pro |

### Short description (≤ 80 characters)

```
Solana token research, scam alerts, and AI Sentinel risk scores before you trade.
```

### Full description

```
SyNexus helps you research Solana tokens before you connect your wallet.

Scan any token mint, read Sentinel risk scores, and get plain-language guidance from four intelligence lanes — Aegis (security), Pulse (momentum), Leviathan (whale activity), and Cipher (pattern fusion). Chat with Titan, your AI commander, for briefings and scan help.

WHAT YOU GET (FREE)
• Live token scanner and risk bands
• Community reports and scam alerts
• Educational guides and token detail pages
• Non-custodial — SyNexus never holds your SOL or tokens

SYNEXUS PRO
Unlock deeper Sentinel intel, faster refresh, Oracle briefings, and priority surfaces. Subscription billing on Android opens at synexus.pro in your browser (Google Play policy).

IMPORTANT
SyNexus is for information and education only. It is not financial advice, not a wallet, and not an exchange. Sentinel scores are informational — always do your own research. You sign every trade in your own wallet app.

18+ · Cancel anytime · Privacy: synexus.pro/privacy
```

### Feature graphic (1024×500) — optional overlay text

```
Research Solana tokens · Sentinel risk scores · AI Titan briefings
```

---

## Policy declarations

| Question | Answer |
|----------|--------|
| **Contains ads?** | **Yes** (Google AdSense on home feed) |
| **In-app purchases?** | **Yes** — SyNexusPro subscription (Android: billing on web) |
| **Target audience** | **18 and over** only |
| **News / COVID / Government app?** | No |

### Financial features

- **Yes** — cryptocurrency **information** app
- **Not** a wallet, exchange, DeFi lender, or NFT marketplace
- Users trade in their own wallet apps; SyNexus shows data and links only

---

## Data safety form

**Privacy policy URL:** https://www.synexus.pro/privacy

### Overview

| Question | Answer |
|----------|--------|
| Collect or share user data? | **Yes** |
| Encrypted in transit? | **Yes** (HTTPS) |
| Users can request deletion? | **Yes** — thesynexus@synexus.pro |
| Families Policy (designed for children)? | **No** (18+ app) |

### Data types

**Personal info**

| Type | Collected | Shared | Required | Purpose |
|------|-----------|--------|----------|---------|
| Email address | Yes | Yes (providers) | Optional* | Account, auth, support |
| Name | Yes | Yes | Optional | Display name |
| User IDs | Yes | Yes | Optional* | Account, sync |

\*Required only if the user creates an Operator account.

**Financial info**

| Type | Collected | Shared | Purpose |
|------|-----------|--------|---------|
| Purchase history | Yes | Yes (Square) | Subscription status — not full card numbers |

**App activity**

| Type | Collected | Shared | Purpose |
|------|-----------|--------|---------|
| App interactions | Yes | Yes (analytics) | Usage, page views |
| In-app search history | Optional | No | Token scans (if logged in) |

**App info and performance**

| Type | Collected | Shared | Purpose |
|------|-----------|--------|---------|
| Crash logs / diagnostics | Yes | Yes (hosting) | Stability |

**Device or other IDs**

| Type | Collected | Shared | Purpose |
|------|-----------|--------|---------|
| Device or other IDs | Yes | Yes (Google Analytics) | Analytics |

### Not collected

Precise location · Photos/videos · Contacts · SMS · Full payment card numbers

### Third-party processors

Supabase (auth) · Square (web billing) · Google Analytics & AdSense · Vercel (hosting) · Market-data APIs

### Handling

- **Purposes:** App functionality, analytics, advertising, fraud prevention, account management
- **Data sold:** **No**
- **Deletion:** Email thesynexus@synexus.pro or use https://www.synexus.pro/contact

---

## Content rating (IARC) — typical answers

| Topic | Answer |
|-------|--------|
| Violence / Sex / Language / Drugs | None or none significant |
| Gambling | No (crypto information only) |
| User-generated content | Reports / feedback |
| Location sharing | No |
| Unrestricted internet | **Yes** (loads synexus.pro) |
| Digital purchases | **Yes** (SyNexusPro) |

Terms require **18+** — align target audience with that.

---

## Phone screenshots (≥ 2 required)

**Specs:** PNG or JPEG · 16:9 or 9:16 · min long edge 1080px recommended  
**Capture from:** physical device after internal test install, or export frames from https://www.synexus.pro/about or /trust

### Recommended order (5 screens)

Use these **Play Console captions** (optional promotional text per screenshot):

| # | Screen | File / source | Play caption (≤ 80 chars) |
|---|--------|---------------|---------------------------|
| 1 | **Home / Live scanner** | Home feed or scanner frame | Live Sentinel scans — liquidity, volume, and holder patterns |
| 2 | **Risk score** | Token detail / risk frame | 0–100 risk score with Safe, Warning, or Danger bands |
| 3 | **Whale tracker** | Pulse / Leviathan lane | Leviathan lane — whale concentration and large-wallet moves |
| 4 | **Alerts** | Pulse alerts hub | Real-time Pulse alerts on your watchlist tokens |
| 5 | **Titan AI** | Titan chat / commander | Ask Titan for token briefings and Sentinel context |

### Longer captions (for social or feature graphic backup)

1. **Token scanner** — Live Sentinel scans on liquidity, volume, and holder patterns before you ape.
2. **Risk score** — Every token gets a 0–100 score with clear Safe, Warning, or Danger bands and reasons.
3. **Whale tracker** — Leviathan surfaces top-wallet concentration and large exits in plain language.
4. **Alerts** — Pulse pushes Sentinel hits to your watchlist so you do not miss liquidity or scam signals.
5. **AI assistant** — Titan explains tokens, risk bands, and what the Sentinels see — on demand.

### App icon (512×512)

Export from `public/synexus-symbol.png` or run:

```bash
npm run android:icons
```

---

## Internal testing checklist

After uploading `app-release.aab` to **Internal testing**:

1. Install from Play test link on a physical Android device
2. Cold start — home feed loads (requires network)
3. Pulse → Operator link — sign in works
4. Titan chat returns a response
5. Subscribe → opens Chrome → synexus.pro (not in-app Square on Android)
6. Token scan / detail page loads

---

## Keystore reminder

- Upload key: `android/upload-keystore.jks` + `android/keystore.properties` (gitignored)
- Create once: `npm run android:keystore`
- Back up passwords offline; delete `android/KEYSTORE-BACKUP.txt` after saving
- Bump `versionCode` in `android/app/build.gradle` before every new upload
