# Learning content provenance and reuse

Checked 15 November 2026. This is a selected educational collection, not a complete Sahih al-Bukhari edition, a new translation or a scholarly certification.

## Hadith text

Publisher: [HadeethEnc — Encyclopedia of Translated Prophetic Hadiths](https://hadeethenc.com/en/home). Official downloads: [English CSV](https://hadeethenc.com/en/browse/download/en/csv), [Urdu CSV](https://hadeethenc.com/en/browse/download/ur/csv). The bundled English edition is v1.25.0; Urdu is v1.36.0. Complete publisher version transcripts and download SHA-256 hashes are in `public/hadith.json` and edition notices are visible in Learn.

The publisher allows free downloading and republication subject to its [Terms and Policies](https://hadeethenc.com/en/home): preserve content unchanged, attribute the publisher/source and version, retain edition information, report translation issues, follow updated editions and avoid inappropriate advertising. This is conditional permission, not a blanket public-domain licence. The app has no advertisements. Check the current terms before redistribution.

Each selected entry preserves all fifteen official CSV fields, including Arabic text, translation, explanations, benefits, grade and attribution. Labels and topics are separate app navigation metadata, not replacements for publisher titles. Each entry includes a canonical-record SHA-256 checksum; no text is machine-translated or silently rewritten.

The publisher's Arabic grade for each selected record is sahih, with Bukhari or agreed-upon attribution. The following Bukhari references were cross-checked against the corresponding reference pages; **their English translations were not copied**. HadeethEnc sometimes includes parallel narrations (including Muslim), so its wording must not be represented as the verbatim text of one Bukhari translation.

| HadeethEnc ID | Cross-check reference | Topic |
| --- | --- | --- |
| [5913](https://hadeethenc.com/en/browse/hadith/5913) | [Bukhari 5027](https://sunnah.com/bukhari:5027) | Learning Quran |
| [5437](https://hadeethenc.com/en/browse/hadith/5437) | [Bukhari 6018](https://sunnah.com/bukhari:6018) | Speech and hospitality |
| [5351](https://hadeethenc.com/en/browse/hadith/5351) | [Bukhari 6114](https://sunnah.com/bukhari:6114) | Self-control |
| [5346](https://hadeethenc.com/en/browse/hadith/5346) | [Bukhari 6021](https://sunnah.com/bukhari:6021) | Good deeds |
| [5504](https://hadeethenc.com/en/browse/hadith/5504) | [Bukhari 6094](https://sunnah.com/bukhari:6094) | Truthfulness |
| [4182](https://hadeethenc.com/en/browse/hadith/4182) | [Bukhari 5971](https://sunnah.com/bukhari:5971) | Parents |
| [5507](https://hadeethenc.com/en/browse/hadith/5507) | [Bukhari 6406](https://sunnah.com/bukhari:6406) | Remembrance |
| [4717](https://hadeethenc.com/en/browse/hadith/4717) | [Bukhari 13](https://sunnah.com/bukhari:13) | Wanting good for others |
| [58120](https://hadeethenc.com/en/browse/hadith/58120) | [Bukhari 5376](https://sunnah.com/bukhari:5376) | Mealtimes |
| [5866](https://hadeethenc.com/en/browse/hadith/5866) | [Bukhari 69](https://sunnah.com/bukhari:69) | Making things easier |
| [10101](https://hadeethenc.com/en/browse/hadith/10101) | [Bukhari 10](https://sunnah.com/bukhari:10) | Avoiding harm |
| [4709](https://hadeethenc.com/en/browse/hadith/4709) | [Bukhari 6116](https://sunnah.com/bukhari:6116) | Anger |

## Practices and Prophet stories

`public/learning-content.json` contains original Akhlaq editorial summaries and suggestions. Every practice points to a bundled narration; every story paragraph points to a Quran verse range. The summaries were checked against the bundled passages, not copied from a modern storybook. They add no dialogue or unsupported biographical detail. Reflections are expressly personal prompts. Suggestions prescribe no new worship counts, timings or promised rewards.

Stories cover Adam (2:35–37), Nuh (11:36–44), Ibrahim (21:57–69), Yusuf (12:89–92), Musa (20:17–24; 26:61–68), Yunus (21:87–88), Ayyub (21:83–84) and Isa (19:30–36). Reader links open the first verse of each displayed range; readers can continue through the full range in context. Existing Quran publisher attribution and notices remain in the Quran reader.

Original editorial summaries/practice suggestions in `public/learning-content.json`, and editorial labels/topics in `content/hadith-selection.json`, are dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). This applies only to that original editorial material, not HadeethEnc content, Quran editions, audio or dependencies, which retain their own terms.

## Refresh and correction procedure

Before each public release, check the official download page for newer editions and changed terms. Download both official CSV files without editing them, then run:

```sh
python3 scripts/import-hadith.py /path/to/english.csv /path/to/urdu.csv --checked-on YYYY-MM-DD
npm test
```

Inspect the full diff and recheck every changed attribution/reference. The importer rejects malformed schemas, wrong languages, duplicate IDs and selected records lacking the expected grade/attribution. It preserves the official fields rather than reconstructing a translation. Do not use the date flag as a substitute for review; it records the review date you supply. Updating content is a reviewed release step, not a silent network fetch on users' devices.

Report translation issues to [HadeethEnc](https://hadeethenc.com/en/home/contact); report app mapping or summary issues to the [Akhlaq issue tracker](https://github.com/aliahmed7866/Akhlaq/issues). Do not alter source wording locally as a correction. Refresh from a corrected publisher edition. Independent scholarly review has not been completed; never label the app or its translations “100% verified”.
