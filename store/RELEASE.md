# Play submission guide

Status: release preparation, not a published or approved Play app. All work stays on `android-standalone`; `main` is unchanged.

## Build artifacts and signing

`Android preview APK` builds `uk.akhlaq.app.preview` for phone testing. `Android release bundle` builds `uk.akhlaq.app`, target API 36, minimum API 26. The production package is separate from the preview; use practice export/import to transfer records. An AAB is uploaded to Play Console, not installed directly on a phone.

Every push to this branch runs both workflows. The release workflow tests the app, runs release lint, builds the AAB and inspects its bundled content. It does not publish anything to Play. Without signing credentials the artifact is named `Akhlaq-Play-unsigned-for-inspection`; do not upload that artifact. Partial credentials cause a clear build failure.

Create a dedicated upload key if this is a new Play app. If this package already exists in your Play Console, use its existing upload key instead. Keep a private backup; never commit keys or passwords. Do not reuse the preview/debug key for production.

```sh
keytool -genkeypair -v -keystore akhlaq-upload.jks -alias akhlaq-upload \
  -keyalg RSA -keysize 3072 -validity 10000
```

Enter the real publisher details interactively. Add these repository Actions secrets in GitHub Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `AKHLAQ_KEYSTORE_BASE64` | Base64-encoded upload keystore file |
| `AKHLAQ_KEYSTORE_PASSWORD` | Keystore password |
| `AKHLAQ_KEY_ALIAS` | Upload key alias, for example `akhlaq-upload` |
| `AKHLAQ_KEY_PASSWORD` | Key password |

Do not paste secret values into issues or build logs. The workflow decodes the keystore into a runner temporary file, signs the AAB, verifies its signature and removes the temporary key. The signed artifact is `Akhlaq-Play-upload-signed`.

For local builds, set `AKHLAQ_KEYSTORE_PATH` to the absolute private key path and the other three signing environment variables. Run:

```sh
npm ci --include=dev --ignore-scripts
npm test
cd android
./gradlew testReleaseUnitTest lintRelease bundleRelease
```

The output is `android/app/build/outputs/bundle/release/app-release.aab`. Enable Play App Signing in Play Console and use this upload key. Increment `versionCode` in `android/version.properties` for each new upload. Never replace an existing release signing identity casually. This release does not include native `.so` libraries; the archive check fails if that changes, requiring a 16 KB page-size review.

## Content and usability release checks

Read `content/PROVENANCE.md` and refresh the official HadeethEnc editions before a public release. Preserve source fields, edition transcripts and attribution. The current selection has twelve narrations; do not advertise a complete Bukhari library or 100% scholarly verification. Seek independent review of religious summaries and Urdu text.

Read `docs/USABILITY.md` for evidence, tested tasks and remaining user/device research. Run `scripts/check-learning-browser.py` alongside the existing audio and native-bridge browser regressions. The app's saved-hadith, chosen-routine and reading-comfort preferences remain local and are not included in the practice-export format.

## Store material

- Listing copy: `store/LISTING.md`.
- Icon: `store/graphics/icon-512.png`.
- Feature graphic: `store/graphics/feature-1024x500.png`, with editable SVG source.
- UI preview screenshots, if present under `store/screenshots`, are browser captures of the shared interface. They are review drafts, not proof of Android behavior. Capture at least two screenshots from the final installed build and verify the visible features before publishing.
- Privacy page: `public/privacy.html`, available offline in Settings. Host the same content on a public HTTPS page with no login, region restriction or PDF download. Set that URL in Play Console. No public policy URL has been deployed by this change. The CSS reference can be adapted by the hosting site without altering policy content.
- Provide your chosen public support email and publisher/developer identity in Play Console. Add a private support channel to the policy if you want to accept private privacy enquiries. The current support link is a public GitHub issue tracker.
- Review the text and audio providers' redistribution, caching and attribution terms before store distribution. Text transcripts/notices are retained, but this project does not represent a separate grant of audio licensing rights.

## App content declarations

Use the code inventory below when completing the declarations. These are preparation notes, not a submitted or legally certified Data safety response. In particular, review the third-party providers' current logging/retention practices before deciding collection/sharing categories.

| Feature / data | Actual app behavior |
| --- | --- |
| Account / ads / analytics | No accounts, ads, advertising ID permission, analytics or crash-reporting SDK |
| Location | Optional foreground fine/coarse permission; local prayer/Qibla calculation, coordinates not sent by Akhlaq to providers |
| Prayer records, reflections, saved verses/hadiths, chosen routine | App-private local storage; no app-operated server; explicit backup export |
| Audio | HTTPS requests to `cdn.islamic.network`, `d.quranenc.com`, `everyayah.com`; providers see IP, requested verse URL and request metadata |
| Downloaded recordings | Private local cache, user-removable; no automatic stream caching |
| App deletion | Settings → About → Erase my data clears local app data after a native confirmation; exported files remain separately |
| External support | Opening GitHub or source links leaves the app; any issue the user submits is public |

Declare both foreground service types under App content:

- `mediaPlayback`: user starts Quran audio; the media notification allows pause/resume; the native queue continues between verses and translations with screen off. Supply an actual screen recording showing this flow.
- `dataSync`: user requests a surah download for offline use; the progress notification opens the app and the Offline audio panel can pause/remove downloads. The service pauses and stops on the Android background-time limit. Supply a recording of starting, monitoring and stopping a download.

No background-location or full-screen-intent permission is requested. Optional prayer alerts request SCHEDULE_EXACT_ALARM access explicitly; they use approximate timing without it. Story narration is an additional mediaPlayback foreground-service use case. Calendar export does not grant exact alarm access. App access needs no login. Complete the audience, ads and IARC content-rating forms truthfully; do not invent ratings or tester results.

## Test before submission

Record device model, Android version, build version, date and result for every row. Automated Node/JUnit/lint/build checks do not cover these phone behaviors.

| Scenario | Expected result | Status |
| --- | --- | --- |
| Clean install, airplane mode | Quran in all three languages, prayer times, search and practice work | Pending device test |
| Arabic → English and Arabic → Urdu | Same verse is translated, then next verse; last verse completes | Pending device test |
| Screen lock / Recents dismissal | Audio transitions continue, controls pause/resume; Stop stops audio | Pending device test |
| Offline audio | Download a short surah, disable network, play every selected part | Pending device test |
| Calls / headset disconnect | Audio focus and noisy-audio behavior are correct | Pending device test |
| Location denied / approximate / granted | City fallback works; correct coordinates and time zone are shown | Pending device test |
| Qibla / missing sensors | Calibrated bearing sensible; unsupported sensor behavior explained | Pending device test |
| Android 16 navigation / keyboard | Back works; keyboard and system bars do not cover controls | Pending device test |
| Download timeout / no network / low storage | No crash or runaway service; retry/pause is usable | Pending device test |
| Erase data | Confirm cancels or clears all app data; exported backups untouched | Pending device test |
| TalkBack / large font / landscape / tablet | Controls labelled, text readable, focus and layout usable | Pending device test |
| Signed release update | Play internal-test install and same-key update preserve records | Pending device test |

Upload the signed AAB to an internal testing track, check Play's pre-launch report, resolve crashes/ANRs and verify data declarations. New personal developer accounts created after 13 November 2023 generally need a closed test with at least 12 opted-in testers for 14 continuous days before applying for production access. Follow the requirements shown for your account; do not claim testing that did not occur.

## Official references checked 14 November 2026

- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [App signing](https://developer.android.com/studio/publish/app-signing)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Privacy policy and app content](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Foreground service declarations](https://support.google.com/googleplay/android-developer/answer/13392821)
- [Store graphics](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Personal account testing](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Data-sync time limits](https://developer.android.com/develop/background-work/services/fgs/timeout)


## Version 2.2 additions

Location-first setup without a city dropdown; optional Android prayer alerts and advance reminders; attributed spoken adhan; Quranic dua directory; seven dhikr counters; six traditional kalimat learning cards; five pillars; estimated Hijri calendar, upcoming readings and private date notes; offline-device English narration of original cited stories. See `docs/FEATURE-RESEARCH.md` and `content/PROVENANCE.md` for the comparison, sources, reuse terms and limitations. Calendar notes, practice marks and narration progress remain local and are not included in the existing practice-export format.
