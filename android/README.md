# Standalone Android preview

This branch packages Akhlaq as an Android app. No Termux, Node server, browser tab or account is needed on the phone. Minimum Android version: 8.0 (API 26).

## What is included

- The existing interface, prayer calculation engine, city presets, practice log and Quran search.
- Arabic and English Quran text plus the complete Muhammad Ibrahim Junagarhi Urdu translation, publisher transcript and footnotes, available offline from first launch.
- Native Android Media3 playback. The service queues each Arabic verse and its English or Urdu recording, so transitions continue without the screen or WebView running. Android notifications, audio focus, headset disconnection and media controls use the native player.
- Optional surah downloads in the selected audio mode. Open Quran → Offline audio. Downloads are stored privately and shared with playback. Streaming alone does not build a permanent audio cache. Downloaded text and practice records are unaffected by Remove audio downloads. Download retry resumes existing requests; Pause downloads pauses pending work.
- Android location permission and rotation-vector compass sensors. The compass is stopped when the screen is hidden; audio is not.
- Android document pickers for practice backup, restore and prayer calendar export.

The native notification’s next/previous buttons move between audio parts. The in-app Prev/Next buttons move between verses. Force-stopping the app, rebooting, or some manufacturer battery controls can still stop playback. A stopped process restores its queue paused; press Resume to continue.

## Install and test

Install the preview APK on Android, allowing installation from the app used to open it if Android prompts. The preview package is `uk.akhlaq.app.preview`, separate from the installed web app and a future production package. This preview is development-signed. It is not a Play Store release; keep a backup before replacing a preview signed by a different build machine.

On a phone, verify:

1. Open in airplane mode and read Arabic, English and Urdu; check prayer times and practice entries.
2. Allow location, then start the Qibla compass away from metal. Confirm its bearing against a known direction.
3. With internet, play Arabic → Urdu, lock the screen, and dismiss the app from Recents. Verify both languages and subsequent verses continue. Use the media notification to pause/resume.
4. Download a short surah, wait until its pending count is zero with no failures, enable airplane mode, and play it.
5. Stop playback, close and reopen, export/import a practice backup, and deny location permission to check city fallback.

Automated checks do not replace these physical-device tests.

## Build

Install JDK 17, Node 20+ and Android SDK platform 36 / build tools 35. From the repository root:

```sh
npm ci --include=dev --ignore-scripts
npm test
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

The APK is `app/build/outputs/apk/debug/app-debug.apk`. The first build fetches the official QuranEnc Urdu CSV, validates all 6,236 verse references, and packages the edition and notices. Subsequent local builds reuse `data/urdu.json.gz`; delete that generated file to refresh from the publisher. Build dependencies and the initial translation fetch need internet; the installed app does not fetch Quran text.

The branch’s GitHub Actions workflow builds the same preview and uploads an APK artifact. A production release requires a retained private release signing key and installation/update testing. Do not commit signing keys. The local preview debug key should be retained privately if updates to that exact preview are needed.

## Play release preparation

The separate `Android release bundle` workflow builds and checks the production `uk.akhlaq.app` AAB. Without upload-key secrets its artifact is clearly labelled `unsigned-for-inspection`; it is not uploadable to Play. Configure all four signing secrets described in [the release guide](../store/RELEASE.md) to produce an upload-signed bundle. This workflow never publishes to Play. Release versioning is in `android/version.properties`.

Android 16 Back navigation, keyboard/system insets, adaptive launcher icons, a packaged privacy policy, confirmed local-data deletion, and graceful data-sync timeouts are included. Physical Android testing, public policy hosting, developer identity/contact details and the Play Console declarations remain release gates; see the guide and test matrix.

## Privacy and integration

The WebView only renders packaged files from `https://appassets.androidplatform.net`. Remote navigation opens outside the app, remote subresources and frames are blocked, and bridge audio commands resolve only the app’s known Quran sources. The exported media service admits only this app and trusted system controllers. Automatic cloud/device-transfer backup is disabled; practice export is explicit. The app does not start, stop or modify other Termux apps.

Existing web-app data is in a separate browser profile. Export practice data there and restore it here; browser settings, saved verses and listening position do not migrate automatically. Quran and Urdu publisher notices remain available under Quran sources.
