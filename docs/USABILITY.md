# Akhlaq usability review — 15 November 2026

Scope: the shared Android/browser interface on `android-standalone`, release 2.1.0. This is desk research, a task-based expert review and automated browser testing. No interviews, observation sessions, production analytics or controlled user study were conducted. The changes are evidence-informed hypotheses; task success with actual users remains to be measured.

## Evidence and decisions

| Evidence | Application to Akhlaq | Limits |
| --- | --- | --- |
| [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps) recommends sufficiently large touch targets and readable contrast. | Main buttons, selections, labelled checkbox targets and navigation have a 48 CSS-pixel minimum height; focus remains visible. | CSS pixels approximate Android dp in this WebView; physical-device and TalkBack testing are still required. Small inline source links retain their text-link role. |
| [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) describes usable vertical content at 320 CSS pixels, allowing genuinely two-dimensional content such as tables to scroll. | Prayer tiles and action groups reflow; fields use flexible widths. App text can scale to 200%. Navigation/player heights are measured so bottom content has sufficient space. | The weekly comparison table scrolls horizontally within its own container. This audit is not a WCAG conformance certification. |
| [Android 14 font scaling guidance](https://developer.android.com/about/versions/14/features) describes support for larger font scaling. | Added a persistent app-wide reading-comfort selector, separate from Quran-specific text sizing. | Browser tests use CSS enlargement, not Android's nonlinear system scaling; test both together on phones. |
| [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) recommends showing essential choices first and revealing advanced details when needed. | Learn begins with recognisable topics; each hadith expands on request. Arabic, publisher explanations and edition notices have labelled disclosures. Quran focus reading remains available. | Do not conceal authenticity/edition attribution: a Bukhari reference is visible before expansion, with source details inside. |
| [Nielsen Norman Group: recognition and recall](https://www.nngroup.com/articles/recognition-and-recall/) explains the value of visible choices over requiring remembered commands. | Labelled main navigation, topic filters, visible reference numbers, saved hadiths and an explicit no-results reset. Arabic/Urdu reference numerals also work. | Labels and the distinction between Practice and Learn need testing with new users; no benefit percentage is claimed. |
| [Stojanovic, Grund & Fries (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9226889/), DOI 10.3389/fpsyg.2022.883795, examined context stability in a student intervention (N=95) and observational app data (N=218). | A user chooses one manageable routine linked to a familiar cue; that choice stays on Today. Suggestions are optional, without streak penalties or invented religious rewards. | This was not research on Muslims or religious devotion. The app-data study was observational. Applying the findings here is an inference, not evidence of improved faith or a guaranteed habit-formation deadline. |

## Tasks and design hypotheses

These scenarios derive from the user's requests, not invented demographic personas.

| Situation | Desired outcome | Design response |
| --- | --- | --- |
| A short visit around prayer time | Find the next prayer without setup friction | Keep the next prayer and today's times first; retain city/manual/GPS choices in Settings. |
| Returning Quran listener | Continue from the same verse and language | Preserve the existing paired audio queue, background service and listening position; regression-test them. |
| Urdu reader checking a hadith | Read a translation, inspect Arabic and verify its reference | Urdu language metadata and RTL text, preserved open narration when switching language, source links and publisher explanations. UI labels and story summaries remain English. |
| Someone learning a small daily practice | Choose a realistic action and return to it | One chosen routine on Today, cue and action explained, evidence one tap away. No moral score or completion pressure. |
| Someone checking a Prophet story | Distinguish summary from scripture | Explicit editorial labels and paragraph-level Quran ranges. Read the full passages in the existing reader. |
| Low vision or imprecise touch | Read and operate the same features | App text sizes through 200%, wrapping controls, 48px primary targets, focus indicators and a keyboard skip link. |
| Weak connectivity or storage problems | Read offline and recover from errors | Bundled learning content; visible retry; failed saves never claim success. |

## Findings fixed during task testing

- Changing hadith language collapsed the opened narration. Open cards now survive language changes.
- Removing a saved item could discard keyboard focus. Focus now moves to the next available action or filter reset.
- Prayer tiles, the resume-reading row and practice-date buttons overflowed at 200% text. They now wrap or change column count.
- Fixed navigation and audio controls previously relied on hard-coded space. A ResizeObserver now reserves their actual heights.
- New learning routes now move focus to the relevant heading or narration, and the skip link focuses main content without changing the route.
- Search initially required Western digits. Arabic and Urdu numerals now match the same reference.

## Verification

`npm test` includes content-integrity, reference-range, preference validation and numeral-search tests. The importer records CSV and individual-record SHA-256 hashes; those prove preservation, not religious correctness.

`python scripts/check-learning-browser.py` exercises home → hadith, reference search, Urdu switching, saved-item persistence/removal, selecting a routine and restoring it, a story → Quran link, persisted text size, skip-link behaviour, failed loading/retry and failed storage. It checks nine routes at widths 320/390/768 and 100%/200% text (54 combinations). The weekly table's own horizontal scrolling is intentionally excluded from page-overflow failure.

`python scripts/check-player-browser.py` tests paired playback, navigation, phone actions and exact-language resume using synthetic audio. `python scripts/check-android-bridge.py` checks the JS/native command contract, offline Urdu and compass events with a bridge fixture. These do not prove physical-device background operation.

The APK/AAB workflows additionally run Android unit tests, lint and packaging checks. See the branch's Actions results for the exact commit; do not infer a pass from this document alone.

## Follow-up research before a public launch

Recruit consenting English and Urdu readers, including older users, a TalkBack user and people with different levels of familiarity with Islamic apps. Avoid assumptions that any one person represents the community. Ask them to find today's next prayer, resume Arabic → Urdu playback, find Bukhari 6114, verify a story reference and choose/change a routine. Observe first-attempt completion, wrong turns, assistance needed and a simple ease rating after each task. Do not collect prayer histories or private reflections for usability research.

Test on actual low/mid-range Android phones: TalkBack reading order and pronunciation, large system fonts plus app scaling, landscape/keyboard/insets, offline first launch, interrupted downloads, lock-screen audio and battery restrictions. Ask a qualified reviewer to review the religious selections and Urdu wording independently. Resolve blocking issues before claiming accessibility, scholarly approval or Play readiness.
