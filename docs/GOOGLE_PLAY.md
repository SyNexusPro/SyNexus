# Google Play submission (SyNexus / Capacitor)

## What you ship

- Google Play expects an **AAB** (Android App Bundle), built as **release** and **signed**.
- Artifact path after a successful build:  
  `android/app/build/outputs/bundle/release/app-release.aab`

## Prerequisites

- **JDK 17+** installed and `JAVA_HOME` set (Android Studio bundles one; CLI builds need this or Gradle will fail).
- Without `android/keystore.properties`, **release** builds fall back to the **debug** keystore for local testing only — **Google Play rejects debug-signed bundles**. Create a real upload keystore before your first store upload.

## One-time: upload signing key

1. Copy `android/keystore.properties.example` → `android/keystore.properties` (local only; gitignored).
2. Create **`android/upload-keystore.jks`** (or path you reference in `storeFile`).
3. Run `keytool` as in the example file comments; note **alias**, **passwords**.
4. **Back up** the JKS file and passwords offline. If you enroll in Play App Signing, Google still needs your consistent upload cert.

See [Sign your release](https://developer.android.com/studio/publish/app-signing) and Play Console signing setup.

## Version numbers

Every new Play upload needs a **strictly larger** `versionCode` (`android/app/build.gradle` → `defaultConfig.versionCode`).  
Bump `versionName` (user-visible) when you ship meaningful releases (keep it aligned with `package.json` if you prefer).

## Remote WebView (production APIs)

The Android shell loads **`https://www.synexus.pro`** at runtime (`capacitor.config.ts` → `server.url`), so checkout, Titan chat, auth, and other `/api/*` routes hit Vercel instead of the bundled `dist/` folder.

For local UI testing against bundled assets only:

```bash
set CAPACITOR_USE_LOCAL=1
npm run build && npx cap sync android
```

Override the remote origin with `CAPACITOR_SERVER_URL` if needed.

## Build & sync

From the repo root:

```bash
npm run build
npm run android:bundle
```

This runs Web build → `cap sync` → `bundleRelease`.  
Outputs the AAB above.

For a signed **APK** (sideload / testers only):

```bash
npm run android:apk
```

## Account deletion URL (Play Console)

Play Console → **App content** → **Data safety** / account deletion:

**https://www.synexus.pro/account-deletion**

Page explains how to request deletion, what is deleted vs retained, and the ~30-day timeline. Alias: `/delete-account` redirects to the same page.

**Delete some/all data without closing the account:**  
**https://www.synexus.pro/data-deletion**

## Whale alerts (Pro)

See [WHALE_ALERTS.md](./WHALE_ALERTS.md) — Helius webhook + Web Push + in-app toast for large buys within seconds.

## App access (Google Play reviewers)

Play Console → **App content** → **App access**. Declare that login is required and provide:

| Field | Value |
|-------|--------|
| **Email** | `google-review@synexus.pro` |
| **Password** | `GoogleRocks2026` |
| **Instructions** | Open the app → Operator Link / Sign in (Pulse or home auth). Use the credentials above. Account has **SyNexus Pro** full access for review. No 2FA. |

Provision / refresh the account against Supabase (service role in `.env`):

```bash
set GOOGLE_PLAY_REVIEW_PASSWORD=GoogleRocks2026
npm run play:provision-reviewer
```

## Play Console checklist (high level)

- **App details**: short / full description, screenshots, icon, feature graphic.
- **Content rating questionnaire** complete.
- **Target audience** & declarations (ads, COVID‑19 apps, news, etc.) as applicable.
- **Privacy policy URL** — required if you collect or process user data (e.g. auth, subscriptions).
- **Data safety** section — disclose data collected (e.g. account, diagnostics, Square billing metadata).
- **Ads** — declare **Yes** if AdSense runs on the home feed (`VITE_ADSENSE_HOME_SLOT`).
- **Subscriptions** — On **Android**, Subscribe opens **synexus.pro in the system browser** (no Square checkout inside the app shell). Web and iOS still use Square. Confirm Play Console declarations match ([Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738)).
- **App access** — paste the reviewer credentials from the section above.

## QA before release

- Install release build on a device (internal testing track).
- Cold start after `cap sync`; exercise auth, Square checkout, Titan chat, offline errors (app needs network for prod WebView).
- Confirm **no cleartext** requirements for prod APIs you call (HTTPS only).

**Store listing copy, Data safety answers, and screenshot captions:** [GOOGLE_PLAY_STORE_LISTING.md](./GOOGLE_PLAY_STORE_LISTING.md)

## Troubleshooting (Windows / Play only)

| Error | Meaning | Fix |
|-------|---------|-----|
| `android platform already exists` | You ran `npx cap add android` but `android/` is already in the repo | **Do not re-add.** Use `npm run cap:sync` or `npx cap sync android` |
| `Xcode is not installed` from `npx cap doctor` | Normal on Windows — iOS is not needed for Google Play | Use `npm run android:doctor` instead |
| `npm install @capacitor/core@capacitor/cli@...` ERESOLVE | Wrong syntax — `@` was used between package names | Capacitor is already installed. Run `npm install` only |
| Gradle `SDK location not found` | Android SDK path missing | Create `android/local.properties` with `sdk.dir=...` (see local machine) |
| Gradle `invalid source release: 21` | JDK too old | Use **JDK 21** (Temurin), not Android Studio's JDK 25 |

## Troubleshooting Gradle

Open `android/` in Android Studio → **Build > Generate Signed Bundle/APK** is an alternative to CLI if you prefer a GUI for the first signing flow.
