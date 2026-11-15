# Current location repair — 2.3.1

The APK previously relied on WebView `navigator.geolocation` and replaced all failures with a permission message. A 12-second timeout, a disabled location service and a denied permission were indistinguishable. GPS success also passed through the full settings-form validator, so an unrelated invalid draft field could prevent the update. These are code findings; no device log was supplied to establish which one affected the reported phone.

The APK now requests foreground location through Android LocationManager, using enabled fused, network and (with fine permission) GPS providers. It needs no Google Play Services SDK, paid API, background permission or Termux. Fine and coarse permissions are requested together; an approximate-only grant is supported when a suitable provider exists. Permission results resume the pending request after the activity becomes visible.

Requests stop after success, cancellation, timeout or leaving the foreground. A fine fix can complete immediately; a broader fix gets a short opportunity to improve. Fixes older than 60 seconds, invalid coordinates and accuracy worse than 5 km are rejected. There is no unbounded last-known-location fallback. The device's reported accuracy is retained and displayed. The request times out after 30 seconds of locating; the web bridge has a separate watchdog for missing responses or abandoned permission prompts.

Today, Qibla and Settings share the same request and cancellation state. Permission failures link to Android app settings; disabled location links to phone location settings. Failures preserve the previously saved coordinates. Saving a successful location is independent of unsaved prayer-setting fields. Browser/PWA use still supports browser location, a lower-accuracy retry after timeout/unavailability, and the existing Termux fallback. Browser permission refusal does not silently invoke another location source.

## Regression coverage

- Node: native request correlation, no browser call in Android mode, cancellation, watchdog, recovery actions, invalid coordinates, browser fallback and denied-permission behavior.
- Browser: all three location entry points, disabled/denied recovery links, cancel/retry, invalid responses, preserved saved location, invalid draft settings, and native-only routing. Existing compass, audio and 78 layout combinations are retained.
- Android: Robolectric exercises the actual CurrentLocation class on API 28 and 35 for GPS success, approximate-only network access, improved fixes, disabled services, denied permission, stale/broad fixes, timeout, cancellation and retry. These are simulated Android services, not physical GPS measurements.

## References

- [Android LocationManager](https://developer.android.com/reference/android/location/LocationManager)
- [Android runtime location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions/runtime)
- [Robolectric setup](https://robolectric.org/getting-started/)

A physical-phone check is still required for the system permission dialog, actual GPS reception and vendor-specific location services. The APK download is a debug-signed preview, not a Play release.
