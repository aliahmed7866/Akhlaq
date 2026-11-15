# Islamic app comparison and Akhlaq 2.2 decisions

Research date: 15 November 2026. This is a representative comparison of prominent apps using their own published feature descriptions, not an exhaustive census of every popular app, a popularity ranking, or hands-on testing of competing products. Feature availability can depend on platform, country and subscription.

| Product / official source | Published strengths | Akhlaq decision |
| --- | --- | --- |
| [Muslim Pro](https://www.muslimpro.com/features/) | Prayer alerts, Quran, Qibla, calendar, learning and community | Bring daily tools together with labelled shortcuts. Keep original cited learning separate from scripture and retain local storage. |
| [Athan by IslamicFinder](https://www.islamicfinder.org/athan/) | Prayer alerts, PrayerBook, duas, calendar and learning | Add optional per-prayer alerts and advance reminders, a devotional directory and calendar notes. |
| [Pillars](https://thepillarsapp.com/faqs) | Location-based prayer setup, calculation choices, prayer notifications and tracking | Use location access directly, show the saved-location timestamp and make alert permissions understandable. Keep a coordinate fallback for denied access; remove city selection. |
| [Quran Majeed](https://quranmajeed.com/features/) | Quran listening, prayer tools, duas, tasbeeh and additional learning | Keep Quran reading/listening unified; link each Quranic dua to the existing Arabic/English/Urdu reader instead of maintaining conflicting copies. |
| [Tarteel](https://www.tarteel.ai/) | Memorisation support and recitation feedback | Treat speech-based memorisation assessment as a separate future project requiring accuracy evaluation, rather than promising untested correctness. |
| [Quran.com](https://quran.com/apps) | Focused reading, translations and listening | Keep the existing focused reading and source notices. Preserve paired Arabic → translation playback. |

Akhlaq cannot yet claim to surpass every competitor. Its proposed advantage is a calm, private, offline daily companion with visible evidence and no paid API dependency. Widgets, mosque-maintained live timetables, full melodic adhan choices, social features, and recitation-error detection are not delivered by this release. No fabricated engagement metrics or user interviews are claimed.

## Implemented interaction choices

- One-tap current location from Today; no city dropdown. No repeated unsolicited GPS prompt or background-location tracking. Coordinates remain local. The phone's time zone is used and shown for confirmation. Travellers must refresh location.
- Prayer times continue to use the bundled [Batoul Apps Adhan engine](https://github.com/batoulapps/adhan-js), including calculation method, Asr convention, high-latitude handling and mosque offsets. Calculations are not a live mosque feed, and congregational times may differ. No unsupported claim of universal perfect accuracy is made.
- Android reminders are opt-in, with a per-prayer selection, gentle notification or a licensed spoken adhan, and 5/10/15 minute advance reminders. The persisted schedule covers 90 days and updates on app opening or changed settings. A single next alarm is scheduled; each delivery schedules the next. Boot, app update and clock/time-zone broadcasts restore pending alarms. Expired alerts do not produce a backlog of sounds.
- [Android alarm guidance](https://developer.android.com/develop/background-work/services/alarms/schedule) distinguishes exact-alarm permission from notification permission. The app requests notification permission only after an explicit action, offers precise alarm access separately, and reports approximate delivery when access is unavailable. It uses SCHEDULE_EXACT_ALARM, not the more restricted USE_EXACT_ALARM permission. Channels, battery restrictions, Do Not Disturb and force-stop still affect delivery.
- The adhan option uses the unchanged 27-second spoken reading by Jarih, not a purchased recording. Notification sounds can be shortened by Android. Preview it in Settings. It is not a special Fajr recording.
- Calendar: civil Hijri estimate, optional ±2 day adjustment, date exploration, 60-day upcoming-event list and private date notes. Today advances after the saved location's Maghrib. Displayed religious dates require local moon-sighting confirmation; no exact date is invented for disputed historical events.
- Six kalimat: expandable Arabic learning cards, original brief English explanations and reversible practice marks. This traditional teaching arrangement is not claimed to be one six-part hadith. Sources and variations are disclosed.
- Story listening: English device narration of original cited summaries, including calendar readings. Android selects an installed offline voice, runs a foreground service, offers notification pause/resume/stop, and saves the current sentence. Resuming repeats that sentence. Browser narration requires a local voice; browser background playback is not guaranteed. No commercial audiobook or speaker imitation is used.
- Compass: retains true/magnetic correction, tilt/calibration handling and short-arc smoothing; stale sensor readings clear alignment rather than leaving a misleading green indicator.

## Verification and launch limits

Automated checks cover calendar conversion/adjustment, event matching, filtering and ordering alert times, duplicate prayer selection, unavailable solar events, past reminders, source structure, new learning routes and persistence. Browser coverage includes 13 routes at 320/390/768 pixels and 100%/200% text (78 combinations), plus existing Quran playback and native-bridge regressions. Native compile/unit tests/lint and archive checks run in both Android workflows.

Automated tests do not substitute for device validation. Before public release: test exact permission grant/revocation, blocked channels, reboot, Doze, travel, clock changes, 90-day expiry, notification sound duration, offline TTS voice installation, headset disconnection, audio focus with Quran/other apps, and a locked screen on several Android vendors. Have a qualified religious reviewer examine the new editorial summaries and traditional wording. The Play foreground-service declarations now include story narration; the public privacy policy and store description must match this release.
