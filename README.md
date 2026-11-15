# Akhlaq

A private Android web app for prayer times, finding the Qibla, reading and listening to the Quran, and daily practice. Termux serves the app at a local address. Android Chrome can install it with its own icon.

## Set up in Termux

```sh
pkg update
pkg install git nodejs-lts
git clone https://github.com/aliahmed7866/Akhlaq.git
cd Akhlaq
node server.mjs
```

Open [http://127.0.0.1:8786](http://127.0.0.1:8786) in Android Chrome and tap **Install app**. If Chrome does not offer an in-page prompt, open its ⋮ menu, choose **Install and create shortcut** or **Add to Home screen**, then tap **Install**. Open Akhlaq again from its icon.

Wait for **Ready for offline use** in the footer before stopping Termux. Once the app is cached, its timetable, saved location, compass, Quran text and practice tools work without internet or a running server. Termux is needed for the first load, app updates and the optional Termux GPS fallback.

### Update an existing installation

In the Akhlaq folder, run `git pull --ff-only`. Stop the old Akhlaq server with Ctrl+C in its own Termux session if it is still running, then run `node server.mjs`. Akhlaq ships with its prayer engine built and starts without installing packages. Open Akhlaq on the same address. Use **Update & reload** when the app shows that the update is ready. If your installed version predates this button, close all Akhlaq windows and tabs, then relaunch. Using the same browser profile and address keeps your settings and practice entries.

## Learn and reading comfort

The standalone Android branch adds a **Learn** tab with 1,018 publisher-graded sahih Bukhari-attributed narrations in Arabic, English and Urdu, including 12 everyday selections with checked numbered references, nine sourced daily practice ideas and eight Quran-based Prophet story summaries. Read the publisher explanations, search by word or reference (including Urdu numerals), save a hadith and follow source links. A daily hadith appears on Today. Choose one routine to keep it on your home page.

Settings → Reading comfort adjusts app text through 200%; Quran retains its separate reader sizing. Learning content works offline after the browser's initial cache or immediately in the standalone APK. Saved hadiths and the chosen routine stay on the device; the existing practice-export format does not include these new preferences.

See [content provenance and reuse conditions](content/PROVENANCE.md) and the [usability research and validation report](docs/USABILITY.md). The selected references and preserved publisher text are source-checked, not a claim of error-free translations or independent scholarly certification.

## Prayer times and reminders

- Akhlaq starts with Manchester, the Moonsighting Committee method and Hanafi Asr. Use location access or enter coordinates if access is unavailable. Check the time zone when travelling.
- [Adhan](https://github.com/batoulapps/adhan-js) calculates start times locally. Choose your mosque’s method and Asr convention and adjust individual minutes when needed. The [Islamic Relief Manchester timetable](https://www.islamic-relief.org.uk/resources/prayer-timetables/manchester/) is available for comparison. Check your mosque for congregational times or when the app shows unavailable solar times.
- The Hijri date is a civil-calendar estimate. Local moon-sighting dates can differ.
- **Prayer reminders in your calendar** downloads an ICS file for upcoming prayers in the seven-day timetable. Select the prayers and how early to be reminded. Import the file into a calendar that supports event alerts. If you change location or calculation settings, replace the previously imported events.

## Qibla

The dial shows the true-north bearing and approximate distance to the Kaaba. Where the magnetic model is valid, it also shows the bearing for a magnetic compass. Tap **Start live compass** and hold the phone screen-up. Follow the left or right instruction and hold steady until the dial turns green. Move away from metal and magnetic cases if the heading jumps. The live compass requires usable absolute-orientation readings from the browser and phone.

## Browser and Termux location

Grant precise location to Chrome if prompted. To enable the optional Termux fallback, install the [Termux:API Android add-on](https://github.com/termux/termux-api) from the same distribution source as Termux, grant it location access, and run `pkg install termux-api` in Termux.

## Quran

The Today tab shows a verse that changes with the date in your selected time zone. Open it in context, listen in Arabic followed by the selected translation, or choose English or Urdu for the text. The Quran tab includes all 114 surahs, verse references and Arabic, English, and downloaded Urdu phrase search, a saved-verse collection and translation notes. Tap a verse number to set your reading place and use **Continue reading** on Today to return to it. Older bookmarks appear in **Saved verses**.

- English text and footnotes come from the [Rowwad Translation Center edition on QuranEnc](https://quranenc.com/en/browse/english_rwwad), version **1.0.21** (CSV revision 1, 9 November 2026).
- Urdu translation and notes are by [Muhammad Ibrahim Junagarhi via QuranEnc](https://quranenc.com/en/browse/urdu_junagarhi). Tap the **Arabic + اردو** preset or select Urdu on Today while Termux and internet are available. Akhlaq checks the publisher’s CSV against all 6,236 verse references and saves it in this browser for offline reading. The publisher version and transcript are shown under **Quran sources**.
- Arabic is [Tanzil’s Uthmani text](https://tanzil.net/docs/Text_License), version **1.1**. The reader includes both publisher notices.
- The text works offline after the app caches it. Choose **Arabic + English**, **Arabic + اردو**, or **Arabic only** under **Read & listen** to set text and audio together. For separate choices, use **Playback mode** and **Text, size & playback options**.
- **Arabic → Urdu** plays Arabic then Urdu for each verse before moving on. **Urdu only** is also available. Urdu recordings are read by [Shamshad Ali Khan via EveryAyah](https://everyayah.com/recitations_ayat.html); wording may differ from the displayed Junagarhi translation. English audio comes from [QuranEnc](https://quranenc.com/en/audio), and Arabic recitation is by [Mishary Rashid Alafasy via Al Quran Cloud](https://alquran.cloud/cdn). All audio needs internet; no phone speech voice installation is required.
- The player stays above the tabs with previous, pause/replay and next controls. Tap the verse title to return to its text. Adjust speed from 0.75× to 1.5× or turn off **Continue to next verse** under **Text, size & playback options**; paired modes still finish both parts of the selected verse. A failed recording stays on that verse with a retry button. Text, audio and speed preferences are saved. Today’s Listen button plays only the daily verse, in Arabic followed by the selected English or Urdu translation.
- To refresh the bundled text, use `scripts/import-quran.py` with the official QuranEnc CSV, Tanzil numbered Uthmani text and the Al Quran Cloud Quran edition response for chapter metadata.

## Background listening

Press Play once, then press Home, switch apps or lock the screen. Supported browsers expose the current surah, verse and audio language through Android’s media controls, with play/pause, previous/next verse and seeking. The same audio element carries Arabic → English or Arabic → Urdu through each verse; hiding the page does not pause or restart it. Calls, other media apps and Android power management may interrupt playback.

Fully closing or force-stopping the app/browser can still end a web player. Akhlaq saves the verse, current language and playback position every five seconds, and on pause or backgrounding. Reopen and tap **Resume**; playback never restarts audibly without your action. **Stop** clears the listening session. Updates ask you to pause first, and pull-to-refresh is suppressed while the player is open in supported browsers.

This is a web app, not an Android foreground media service. Lock-screen availability and background lifetime depend on the browser and Android device. No screen wake lock or unrelated Termux service is used.

## Practice and backup

Log each prayer from Today or Practice. Both screens use the same log. Track daily habits, keep reflections, and browse the past week in Practice. The dhikr counter saves progress by day and phrase and supports personal targets of 33, 99 or 100. These targets are counter settings. Use **Back up your practice** to export a JSON file. Restore fills dates missing on the device. Browser data is local to the address and profile, and clearing it removes your entries.

For development, run `npm ci` to install the build and test dependencies. Run `npm run build:engine` and commit the updated `public/engine.js` when prayer calculation code or dependencies change. Run `npm test` to verify the calculation engine, compass math, calendar files, backup format and offline package.

Optional browser regression: install Python Playwright and its Chromium browser, then run `python scripts/check-player-browser.py`. This uses generated audio to check verse transitions, media controls and exact-position resumption; physical Android background and lock-screen testing is still required. Set `CHROMIUM_PATH` to use an existing Chromium executable.

## Standalone Android branch

The `android-standalone` branch contains the independent Android APK project. See [Android setup and preview notes](android/README.md) for building, installing, offline downloads and device verification. The Termux web app remains usable from this source tree.


## Version 2.2 additions

Location-first setup without a city dropdown; optional Android prayer alerts and advance reminders; attributed spoken adhan; Quranic dua directory; seven dhikr counters; six traditional kalimat learning cards; five pillars; estimated Hijri calendar, upcoming readings and private date notes; offline-device English narration of original cited stories. See `docs/FEATURE-RESEARCH.md` and `content/PROVENANCE.md` for the comparison, sources, reuse terms and limitations. Calendar notes, practice marks and narration progress remain local and are not included in the existing practice-export format.

### 2.3.0 refinement

The compass now uses reported sensor accuracy, north-referenced fallbacks, fresh-sample confirmation and magnetic-interference checks. Today has simpler prayer logging and direct reminder access. See [compass and UI review](docs/COMPASS-REFINEMENT.md) for decisions, checks and physical-device limits.

### 2.3.1 location repair

Use current location now calls Android location providers directly in the APK. It supports approximate permission, bounded requests, cancellation, and distinct permission/service-off recovery actions. Location updates no longer depend on validating unrelated draft settings. See [location repair and tests](docs/LOCATION-FIX.md).

### 2.4.0 interface refinement

A clearer phone interface with labelled navigation icons, compact prayer utilities, a Quran toolbox for search/saved verses/advanced options, visible playback language, and expandable learning filters. Dhikr now has a larger count button and displays the selected Arabic phrase and transliteration. Settings → Reading comfort offers Night, Day and Follow phone appearance; text size remains independent. No content editions, prayer calculations or location permissions changed. See [UI review](docs/UI-REFINEMENT.md) for checks and limitations.

### 2.5.0 deeper refinement

Qibla gives one short confirmation buzz after a reliable steady match, with a saved off switch and protection against repeated buzzing. Counter/player layouts and keyboard overlays are more resilient, and reader/prayer options have clearer labels. The offline hadith library now has 1,018 records with paged browsing, title/reference search, English/Urdu switching, saves and source notices. See [deep refinement notes](docs/DEEP-REFINEMENT.md) and [content provenance](content/PROVENANCE.md).

## 2.6.0 refinement

[Research and verification](docs/REFINEMENT-2.6.md): complete paginated Quran search, direct saved-verse access with undoable removal, a compact audio player with guarded per-part seeking, clearer hadith reference search and direct prayer-calculation navigation. Existing Quran translations, 1,018 source-attributed hadiths, Qibla feedback and reminders are retained.
