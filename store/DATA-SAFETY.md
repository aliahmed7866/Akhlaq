# Data safety and permission review — 2.7.0

This is the engineering inventory for the Play Console owner to review. It is not a completed Data safety declaration. Do not infer “no data collected” solely from having no developer server: requested recording URLs can reveal religious reading activity, and provider logs are outside this app's control.

| Data / operation | Actual app handling | Review before submitting |
| --- | --- | --- |
| Approximate or precise coordinates | Requested only after a location action; stored locally; used for local prayer and Qibla calculations. No background location or developer upload. | Declare according to current Play guidance; distinguish device-only processing from data transmitted off-device. |
| Compass sensors | Processed while compass is active; no upload. | Physical-device quality and magnetic-interference checks. |
| Prayer logs, reflections, saved verses/hadiths, habits, calendar notes and listening state | Local private storage. Cloud/device-transfer backup is disabled. No account or developer upload. | Check sensitivity and accurately describe export scope and deletion. |
| Audio streaming/downloads | Direct HTTPS to cdn.islamic.network (Arabic), d.quranenc.com (English), everyayah.com (Urdu). Requests expose IP address, verse URL, timing and technical headers including app version. | Review provider policies, log retention, uses and Play's collection/sharing definitions. Do not claim religious activity or IP data never leaves the device. Record the conclusion and evidence. |
| Bundled Quran, Urdu text, hadith and editorial stories | Offline Android assets; no provider connection needed for reading or search. | Browser/Termux Urdu loading is a separate network flow described in the shared policy. |
| Story narration | Android selects an installed offline English TTS voice for original summaries. | Confirm local voice behaviour on target phones. |
| Exports | Android's document picker writes only a user-selected file. Cancellation/failure is reported. Export destination may be a cloud provider selected by the user. | Disclose user-initiated transfers and the selected provider's responsibility. Practice backup includes prayer log, dhikr and reflections only. |
| External source/support pages | Explicit user action opens an external browser. GitHub issues are public. | Do not request private reflection contents or exact coordinates in support reports. |
| SDKs | AndroidX WebKit/Media3 and platform APIs; no ad or analytics SDK. | Recheck resolved dependencies when versions change. |

Permissions: INTERNET / ACCESS_NETWORK_STATE for requested audio; COARSE/FINE_LOCATION for foreground location; POST_NOTIFICATIONS for optional alerts; FOREGROUND_SERVICE with mediaPlayback for user-started audio/narration and dataSync for user-requested downloads; WAKE_LOCK for media; RECEIVE_BOOT_COMPLETED to restore enabled prayer alerts; SCHEDULE_EXACT_ALARM for separately requested precise reminders. No USE_EXACT_ALARM, background location, broad storage, contacts, camera or microphone permission.

The app has no account creation and therefore no account-deletion flow. Settings → About, privacy & help → Erase my data clears private app data and downloads after confirmation. Uninstall/Android Clear storage also removes it. Exported files and third-party provider logs are not erased by this action.

Complete and review the Play forms, then add a dated evidence reference in `store/readiness.json`. Keep any private account documents outside this public repository.

Sources checked 15 November 2026: [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [User data](https://support.google.com/googleplay/android-developer/answer/10144311), [FGS declarations](https://support.google.com/googleplay/android-developer/answer/13392821).
