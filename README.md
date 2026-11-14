# Akhlaq

A private dashboard for Salah, finding the Qibla, and building habits around Qur’an, dhikr and good character. Termux runs a local server and you use Akhlaq in your phone’s browser.

## Run on Android with Termux

```sh
pkg update
pkg install git nodejs-lts
git clone https://github.com/aliahmed7866/Akhlaq.git
cd Akhlaq
npm ci
npm start
```

Keep the server running and open [http://127.0.0.1:8786](http://127.0.0.1:8786) in your Android browser. To open it from a second Termux session, run `termux-open-url http://127.0.0.1:8786`. Use the same browser and address to access your saved entries. To update, run `git pull --ff-only` and `npm ci` from the Akhlaq folder, then restart the server.

## Location and prayer times

- Akhlaq starts with Manchester, the Moonsighting Committee method and Hanafi Asr. Choose another city, enter coordinates or tap **Use my location**. GPS uses the phone’s time zone. Check the time zone if you’ve travelled and Android hasn’t updated it yet.
- Browser location works when Android and the browser grant location permission. For Termux GPS fallback, install the [Termux:API Android add-on](https://github.com/termux/termux-api) from the same distribution source as Termux, grant it location access, and run `pkg install termux-api`.
- Prayer times are calculated offline with [Adhan](https://github.com/batoulapps/adhan-js). The timetable shows prayer start times, including a separate sunrise entry. Match your mosque by selecting its calculation method and Asr convention and adjusting individual minutes as needed. The [Islamic Relief Manchester timetable](https://www.islamic-relief.org.uk/resources/prayer-timetables/manchester/) is linked for comparison. Check your mosque for congregational times and its high-latitude practice.
- The Moonsighting Committee method applies its own seasonal Fajr and Isha rules. Akhlaq marks unavailable times with a dash when the selected method cannot determine them.

## Qibla and daily practice

The dial gives the true-north bearing. When the magnetic model supports your location and date, it also gives a bearing to use with a magnetic compass. Tap **Start live compass**, allow motion access if prompted, and hold the phone flat and away from metal. Live mode requires a browser and phone that supply absolute heading. The static bearing works without motion access.

Tick prayers and habits as you complete them. Use the arrows to review previous days and **Save reflection** to keep a note. The browser saves settings and practice locally. Clearing this site's browser data removes those entries. Akhlaq runs without internet after installation and listens only on the phone's loopback address.

Run `npm test` to verify the prayer and Qibla calculations.
