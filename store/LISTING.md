# Akhlaq 2.7.0 store copy

The copy to paste into Play Console is in `listing.json`: name, short description, full description and release notes. The release check enforces the respective 30 / 80 / 4,000 / 500 character limits.

Suggested category: Lifestyle. No paid features, account, ads or analytics SDK are implemented. The owner must select the target audience and complete the content-rating questionnaire; the project has not assigned an age rating.

Assets:

- `graphics/icon-512.png`: 512 × 512 app icon.
- `graphics/feature-1024x500.png`: 1,024 × 500 feature graphic.
- **Android device checks** workflow artifacts: four actual Android emulator screenshots, with the source commit, API level and dimensions in `evidence.json`. Inspect these from the final passing build before submitting. They show Today, Arabic/Urdu Quran reading, a sourced hadith and duas.
- `screenshots/*-draft.png`: older browser mockups. Do not submit these as final Android screenshots.

The preview package is `uk.akhlaq.app.preview`. The production package is `uk.akhlaq.app`. They have separate storage. Use a signed production internal-test installation for final store captures if anything differs from the preview build.

The interface and stories are English. Urdu is available for Quran and hadith text and Quran translation audio. Do not label the whole interface as Urdu-localized, claim publisher endorsement, promise perfect compass accuracy or describe the hadith selection as a complete Sahih al-Bukhari edition.
