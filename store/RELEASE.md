# Google Play release guide — Akhlaq 2.7.0

The app targets Android 16 / API 36, supports Android 8 / API 26+, and uses production package `uk.akhlaq.app`, version code **10**. A green inspection build does not mean the app is ready for production submission. Read the generated `store-readiness.json` artifact; outstanding requirements remain explicitly BLOCKED.

## 1. Build and verify

Use the `android-standalone` branch. Every push runs Android preview/unit/lint/browser checks, production bundle checks and an Android 15/16 emulator matrix. The emulator tests disable Wi-Fi/mobile data and exercise actual bundled Quran/Urdu, hadith, saved verses after recreation, large text, native export cancellation and renderer recovery. Captures are from the real app, not a simulated browser bridge. Inspect reports/screenshots for the exact commit being released.

`Android preview APK` creates an installable debug APK under `uk.akhlaq.app.preview`. This is a test package with separate data; it is not the production app and is not a Play upload. `Android release bundle` creates `app-release.aab`. Without signing secrets it is labelled **unsigned-for-inspection**. Never rename an unsigned bundle to imply it is upload-ready.

The bundle inspection verifies the package/version/target API, non-debuggable release, disabled automatic backup/cleartext traffic, exact Android permission inventory, component exposure, complete offline text and notices, all 1,018 hadith records/chunk hashes, no included signing keys and no native `.so` libraries. If native libraries are added later, recheck 16 KB memory-page compatibility.

## 2. Configure the correct upload key

Confirm whether `uk.akhlaq.app` already exists in your Play Console. Use its registered upload key if it does. Do not replace a key or create a conflicting package identity. For a new app, create and securely back up an upload key locally and enrol in Play App Signing.

Configure all four repository Actions secrets (never commit a key/password):

- `AKHLAQ_KEYSTORE_BASE64`: base64-encoded upload keystore.
- `AKHLAQ_KEYSTORE_PASSWORD`
- `AKHLAQ_KEY_ALIAS`
- `AKHLAQ_KEY_PASSWORD`

CI uses a temporary owner-readable keystore, rejects partial configuration, verifies the signed bundle and removes the temporary key. The Play app-signing key and this upload key are different responsibilities. Production updates must use a version code above the highest one already uploaded; code 10 must be checked against your account history.

## 3. Publish privacy and choose support contact

Run `python3 scripts/build-policy-site.py`. The generated `android/app/build/policy-site/` contains a self-contained support page, the same privacy policy as the app, and CSS. It is included in the store-materials artifact. Deploy this directory to your chosen public HTTPS static host. No analytics or external font/script dependency is included.

A public policy URL has **not** been configured by this project. Check it without signing in, including on a phone. It must serve the policy directly as HTML, be accessible without geographic restrictions, and remain available. Do not use a repository source view, private preview, editable document or PDF as the policy URL. Enter the live URL and your chosen public support email in `store/readiness.json` and Play Console. Do not put private account verification documents in the repository.

## 4. Finish rights, device and Play declarations

- Review current Quran text/translation permissions and **separate recording streaming, download and redistribution rights** with each provider. Availability at a free URL is not, by itself, permission. Existing attribution does not replace permission. Keep the exact notices and review `content/PROVENANCE.md` and in-app licences. Recheck HadeethEnc editions/terms; the last direct English edition check was rate-limited. Independent scholarly review is not claimed.
- Review `DATA-SAFETY.md`, provider logs and the actual release. Complete Data safety, app access (no account), ads (none implemented), target audience and content rating. If the chosen audience includes children, assess the additional Families obligations before submitting.
- Declare foreground **mediaPlayback** (Quran/background narration) and **dataSync** (requested audio downloads). Record short actual-device demonstrations starting, backgrounding and stopping these features, plus the visible notifications. Do not use a mockup as evidence.
- Test the signed production package through internal testing. Verify approximate/precise location, denied permission recovery, native export save/cancel/failed destination, background paired audio with screen locked, phone-call/audio-focus interruptions, network loss, downloads, reboot/reminders, time-zone changes, text at 200%, TalkBack, cutouts and landscape. Check compass/haptic behaviour on actual sensor hardware and compare local prayer settings with a mosque timetable. Emulator layout tests do not establish sensor accuracy or manufacturer battery behaviour.
- Use Play's pre-launch report and inspect crashes/ANRs/accessibility findings. Confirm developer-account verification and production access. New personal accounts covered by Google's rule need at least 12 continuously opted-in closed testers for 14 days before applying for production access; follow what your account actually requires. This cannot be replaced by automated tests or a generated report.

Record dated evidence references for each item in `store/readiness.json`. Avoid storing sensitive console details in this public file.

## 5. Run the submission check and upload

Manually run **Android release bundle** with `submission=true`. This fails for missing signing, policy URL, support email or review evidence and verifies the public policy page. The ordinary push workflow still builds inspectable artifacts while those requirements are unfinished. A passing project check is not Google approval.

Upload the verified signed `.aab` to the appropriate Play testing track, use `listing.json` and the store graphics, and review actual screenshots from the same final build. Complete the account's required testing and review before requesting production rollout. Nothing in these workflows uploads to Play or starts a public rollout.

## Official requirements checked 15 November 2026

[Target API](https://support.google.com/googleplay/android-developer/answer/11926878) · [Signing](https://developer.android.com/studio/publish/app-signing) · [Privacy/app content](https://support.google.com/googleplay/android-developer/answer/9859455) · [User data](https://support.google.com/googleplay/android-developer/answer/10144311) · [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) · [Foreground service declarations](https://support.google.com/googleplay/android-developer/answer/13392821) · [Graphics](https://support.google.com/googleplay/android-developer/answer/9866151) · [Testing](https://support.google.com/googleplay/android-developer/answer/14151465)
