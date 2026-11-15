# 2.5.0 — compass feedback, layout resilience and hadith library

15 November 2026; `android-standalone`.

## Compass feedback

A short confirmation haptic accompanies the existing Facing Qibla state. It requires the same steady sample window, reported sensor error at most 10°, location angular error at most 3°, and both raw/smoothed direction within 4°. It does not make the sensor more accurate.

One cue is allowed per approach. Rearming requires a reliable heading at least 12° away for 600 ms; a four-second cooldown prevents repeated cues. Bad readings and stale data cannot rearm it. Start/Recheck begins a new approach. Users can disable the saved Buzz when facing Qibla option.

Android uses `View.performHapticFeedback(CONFIRM)` on API 30+ and `VIRTUAL_KEY` on older supported Android. It respects device haptic settings and needs no new permission. The native bridge also checks active compass, visible view/activity and a four-second cooldown. Browsers use a 35 ms vibration only where supported. See [Android haptic guidance](https://developer.android.com/develop/ui/views/haptics/haptic-feedback). Physical vibration intensity/timing varies by phone.

## UI and behaviour

- Counter and Undo/Reset occupy separate grid rows. Large counts fit inside the count button, with container-aware numeral sizing.
- Audio controls use explicit grid areas; playback language and status each have a full row. The player scrolls within its reserved area on short screens.
- When a focused text field and viewport shrink indicate the on-screen keyboard, navigation and player overlays hide temporarily. This preserves the audio element and playback state; controls return when the keyboard closes. Physical keyboard/inset behaviour still needs device review.
- Prayer tiles now say Mark prayed / Prayed. Reader options distinguish What you read from What you hear.
- Hadith library expands from 12 to 1,018 with twenty-item pages, three-language titles/reference search, an everyday selection, saved-only filtering, lazy local record loading, failure recovery and retained source attribution. See `content/PROVENANCE.md` for selection rules and edition-check limits.

## Checks

- Node tests cover alignment cue hysteresis, unreliable readings, complete hadith records, hashes, publisher attribution, offline assets and existing calculation/playback behaviour.
- Native-bridge browser tests check one buzz while holding alignment, no buzz for poor/unknown readings, and the off preference, alongside existing location/audio/compass checks.
- Deep UI checks exercise paging, an expanded Urdu narration, saves, chunk failure/retry, a previously unopened narration offline, simulated keyboard behaviour, and **96** control/text collision combinations across eight routes, four viewports and three text sizes.
- Existing checks retain 156 reflow/theme combinations, 48 other UI/theme/viewport combinations, paired audio and Android packaging/lint/unit tests.

These are browser simulations and automated Android build checks, not physical-device testing or an accessibility certification. No public-store release is performed by this change.
