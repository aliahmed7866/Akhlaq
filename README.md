# Akhlaq

A private Android web app for prayer times, finding the Qibla, reading and listening to the Quran, and daily practice. Termux serves the app at a local address. Android Chrome can install it with its own icon.

## Set up in Termux

```sh
pkg update
pkg install git nodejs-lts
git clone https://github.com/aliahmed7866/Akhlaq.git
cd Akhlaq
npm ci
npm start
```

Open [http://127.0.0.1:8786](http://127.0.0.1:8786) in Android Chrome and tap **Install app**. If Chrome does not offer an in-page prompt, open its ⋮ menu, choose **Install and create shortcut** or **Add to Home screen**, then tap **Install**. Open Akhlaq again from its icon.

Wait for **Ready for offline use** in the footer before stopping Termux. Once the app is cached, its timetable, city presets, compass, Quran text and practice tools work without internet or a running server. Termux is needed for the first load, app updates and the optional Termux GPS fallback.

### Update an existing installation

In the Akhlaq folder, run `git pull --ff-only` and `npm ci`. Stop the old server with Ctrl+C if it is still running, then run `npm start`. Open Akhlaq on the same address. Close all open Akhlaq tabs and the standalone window, then relaunch if the previous version is still showing. Using the same browser profile and address keeps your settings and practice entries.

## Prayer times and reminders

- Akhlaq starts with Manchester, the Moonsighting Committee method and Hanafi Asr. Choose a city, enter coordinates, or use GPS. Check the time zone when travelling.
- [Adhan](https://github.com/batoulapps/adhan-js) calculates start times locally. Choose your mosque’s method and Asr convention and adjust individual minutes when needed. The [Islamic Relief Manchester timetable](https://www.islamic-relief.org.uk/resources/prayer-timetables/manchester/) is available for comparison. Check your mosque for congregational times or when the app shows unavailable solar times.
- The Hijri date is a civil-calendar estimate. Local moon-sighting dates can differ.
- **Prayer reminders in your calendar** downloads an ICS file for upcoming prayers in the seven-day timetable. Select the prayers and how early to be reminded. Import the file into a calendar that supports event alerts. If you change location or calculation settings, replace the previously imported events.

## Qibla

The dial shows the true-north bearing and approximate distance to the Kaaba. Where the magnetic model is valid, it also shows the bearing for a magnetic compass. Tap **Start live compass** and hold the phone screen-up. Follow the left or right instruction and hold steady until the dial turns green. Move away from metal and magnetic cases if the heading jumps. The live compass requires usable absolute-orientation readings from the browser and phone.

## Browser and Termux location

Grant precise location to Chrome if prompted. To enable the optional Termux fallback, install the [Termux:API Android add-on](https://github.com/termux/termux-api) from the same distribution source as Termux, grant it location access, and run `pkg install termux-api` in Termux.

## Quran

The Today tab shows a verse that changes with the date in your selected time zone. Open it in context or listen in English. The Quran tab includes all 114 surahs, verse and English phrase search, a reading position, a bookmark and translation notes.

- English text and footnotes come from the [Rowwad Translation Center edition on QuranEnc](https://quranenc.com/en/browse/english_rwwad), version **1.0.21** (CSV revision 1, 9 November 2026).
- Arabic is [Tanzil’s Uthmani text](https://tanzil.net/docs/Text_License), version **1.1**. The reader includes both publisher notices.
- The text works offline after the app caches it. **Listen** streams [QuranEnc’s English recordings](https://quranenc.com/en/home/api/) or [Mishary Rashid Alafasy’s Arabic recitation](https://alquran.cloud/cdn). The player can continue through the current surah.
- To refresh the bundled text, use `scripts/import-quran.py` with the official QuranEnc CSV, Tanzil numbered Uthmani text and the Al Quran Cloud Quran edition response for chapter metadata.

## Practice and backup

Log prayers and daily habits, keep reflections, and browse the past week. The dhikr counter saves progress by day and phrase and supports personal targets of 33, 99 or 100. These targets are counter settings. Use **Back up your practice** to export a JSON file. Restore fills dates missing on the device. Browser data is local to the address and profile, and clearing it removes your entries.

Run `npm test` to verify the calculation engine, compass math, calendar files, backup format and offline package.
