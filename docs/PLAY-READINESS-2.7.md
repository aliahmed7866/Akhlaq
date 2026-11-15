# 2.7.0 release preparation

## Changes

- Native backup/calendar exports now distinguish the document picker, successful completed writes, cancellation, a busy picker and failed writes. The app no longer announces success before Android saves the file.
- Android WebView renderer loss offers a native reopen action. Saved local records are retained; the background audio service is independent of the view.
- The trusted asset origin requires HTTPS, the exact hostname, no user credentials and the default TLS port. External pages cannot become privileged app content. Cookies are disabled; mixed content and off-origin resource loads remain blocked; Android Safe Browsing is not disabled.
- Actual Android 15/16 offline UI instrumentation and screenshot generation are added to CI, alongside existing browser/Android unit/lint coverage.
- Release version 2.7.0 / code 10, current audio user-agent version, stricter merged-manifest/permission checks and a production submission check that fails when evidence is missing.
- Current listing copy, data-flow inventory, store graphics validation and a deployable privacy/support site are included as release artifacts.

## Research applied

Official Google requirements were checked on 15 November 2026. API 36 is already targeted. Public privacy, accurate Data safety answers including provider requests, foreground-service declarations, upload signing and account testing are distinct from building a valid bundle. See [release guide](../store/RELEASE.md) for official links and exact steps. Android's [WebView process-management guidance](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview) informed renderer recovery; official [AndroidX Test releases](https://developer.android.com/jetpack/androidx/releases/test) informed the emulator-test dependencies.

## Evidence and remaining work

CI artifacts are tied to their commit. The **Android device checks** artifact contains actual emulator PNGs, API/version metadata, test reports and logcat. **Android release bundle** includes the AAB and a machine-readable readiness report. The unsigned label and BLOCKED report must remain until the relevant evidence exists.

A public privacy URL, chosen public support email, registered upload signing key, provider-rights review, physical phone checks and completed Play account/declarations/testing are not supplied by source-code changes. No Play submission or approval is claimed. A complete guide and ready-to-host policy are prepared so these steps can be completed without guessing.
