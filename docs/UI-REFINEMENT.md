# Akhlaq UI refinement — 15 November 2026

Release 2.4.0 on `android-standalone`. This is an implementation review, screenshot inspection and automated interaction testing, not a new user study or accessibility certification.

## Changes

- **Navigation:** consistent decorative line icons alongside visible labels, clearer active tabs, and direct links between Learn and the companion topics. Icons are original inline SVG; no external icon/font dependency.
- **Today:** clearer next-prayer emphasis, tighter prayer tiles and a single disclosure for timetable/calculation/calendar export. Missing solar-event warnings remain outside the disclosure. Saved-location failure/cancel/recovery controls remain available.
- **Quran:** surah selection, language presets, reading and playback lead the screen. Search, saved verses, reading settings and offline audio share a labelled expandable toolbox. The current playback language remains visible beside Play, including when advanced controls are closed. Save/error status remains outside the toolbox. Focus reading and existing verse/audio handlers are retained.
- **Learn:** topic and saved-only filters expand on demand; their active values appear in the closed summary. Search and translation remain visible. Source and edition information is preserved.
- **Practice and dhikr:** grouped checkboxes, clearer date controls, a larger counter target and visible selected Arabic phrase/transliteration copied from the existing phrase options. No new religious translations or prescribed counts were introduced.
- **Settings:** separated setting groups; Night (default), Day and Follow phone appearance saved locally. Appearance and text size are independent. Failure to save is reported without pretending persistence succeeded.
- **Responsive layout:** measured player/navigation spacing is retained. On short displays the player can scroll internally, keeping its controls above navigation. Reduced-motion preference remains respected.

## Verification

- `npm test`: content integrity, prayer calculations, compass, location, playback, preferences and offline asset inclusion.
- `scripts/check-interface-browser.py`: reader toolbox, search and saved-verse focus, reading mode, theme persistence/system preference, local-storage failure, dhikr controls; 48 theme/route/viewport combinations; landscape player at 100% and 200% text. Saves review screenshots under `android/app/build/ui-review`.
- `scripts/check-learning-browser.py`: existing learning flows plus 156 route/width/text-size/theme reflow and target-size combinations (320/390/768 px; 100%/200% text), offline learning and failure recovery.
- Existing paired-audio and Android-bridge browser checks exercise background command flow, location recovery/cancellation, compass events and Urdu playback. Fixtures simulate hardware/audio; they do not certify real-device operation.
- APK and release workflows run Android unit tests, lint and packaging checks. Check the Actions result for the exact commit before distributing a build.

## Remaining device review

Check installation/update, actual Android system font scaling, TalkBack focus/reading order, keyboard insets, permission dialogs, GPS and compass sensors, and lock-screen audio on a physical phone. The Day theme applies to the app's web content; Android system permission dialogs/status/navigation bars follow platform behaviour. Source texts and calculated prayer methods are unchanged.
