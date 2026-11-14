"""Build the reader data from the official QuranEnc CSV and Tanzil numbered text."""
import argparse
import csv
import gzip
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("english_csv", type=Path)
parser.add_argument("arabic_text", type=Path)
parser.add_argument("surah_metadata_json", type=Path, help="Al Quran Cloud Quran edition response")
args = parser.parse_args()

with args.english_csv.open(encoding="utf-8-sig", newline="") as source:
    reader = csv.reader(source)
    transcript = next(reader)[0]
    version = re.search(r"\((v[\d.]+-csv\.\d+)\)", transcript).group(1)
    assert "english_rwwad" in transcript
    assert next(reader) == ["id", "sura", "aya", "translation", "footnotes"]
    english = list(reader)

arabic_source = args.arabic_text.read_text(encoding="utf-8-sig")
arabic = [line.split("|", 2) for line in arabic_source.splitlines() if re.match(r"^\d+\|\d+\|", line)]
notice = arabic_source[arabic_source.index("# PLEASE DO NOT REMOVE"):].strip()
metadata = json.loads(args.surah_metadata_json.read_text(encoding="utf-8"))["data"]["surahs"]
assert len(english) == len(arabic) == 6236 and len(metadata) == 114
chapters = []
for index, entry in enumerate(metadata, 1):
    assert entry["number"] == index
    chapters.append({"id": index, "name": entry["englishName"], "meaning": entry["englishNameTranslation"], "ayahs": []})
for number, (translation, original) in enumerate(zip(english, arabic, strict=True), 1):
    identifier, chapter, verse, meaning, notes = translation
    ar_chapter, ar_verse, text = original
    assert (chapter, verse) == (ar_chapter, ar_verse)
    verses = chapters[int(chapter) - 1]["ayahs"]
    assert int(identifier) == number and int(verse) == len(verses) + 1 and meaning and text
    verses.append([number, text, meaning, notes])
for chapter, entry in zip(chapters, metadata, strict=True):
    assert len(chapter["ayahs"]) == len(entry["ayahs"])

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()

output = Path(__file__).resolve().parents[1] / "data"
bundle = {"englishTranscript": transcript, "englishVersion": version, "arabicNotice": notice, "chapters": chapters}
with (output / "quran.json.gz").open("wb") as file:
    with gzip.GzipFile(filename="", mode="wb", fileobj=file, mtime=0) as zipped:
        zipped.write(encode(bundle))
