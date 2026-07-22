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

## Play Console checklist (high level)

- **App details**: short / full description, screenshots, icon, feature graphic.
- **Content rating questionnaire** complete.
- **Target audience** & declarations (ads, COVID‑19 apps, news, etc.) as applicable.
- **Privacy policy URL** — required if you collect or process user data (e.g. auth, subscriptions).
- **Data safety** section — disclose data collected (e.g. account, diagnostics, Stripe usage as relevant).
- **Subscriptions** — if SyNexusPro sells via Stripe in-app web view, clarify policy compliance with Play Billing rules ([Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738)).

## QA before release

- Install release build on a device (internal testing track).
- Cold start after `cap sync`; exercise auth, Stripe checkout in WebView if used, offline errors.
- Confirm **no cleartext** requirements for prod APIs you call (HTTPS only).

## Troubleshooting Gradle

Open `android/` in Android Studio → **Build > Generate Signed Bundle/APK** is an alternative to CLI if you prefer a GUI for the first signing flow.
