"""Import complete selected records from official HadeethEnc EN/UR CSV downloads.

Download https://hadeethenc.com/en/browse/download/{en,ur}/csv first.
Review wording/reference changes before committing; builds never refresh silently.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('english_csv', type=Path)
parser.add_argument('urdu_csv', type=Path)
parser.add_argument('--checked-on', required=True)
args = parser.parse_args()
assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.checked_on)
repo = Path(__file__).resolve().parents[1]
selection = json.loads((repo / 'content/hadith-selection.json').read_text())
editions, records = {}, {}
for language, path in [('en', args.english_csv), ('ur', args.urdu_csv)]:
    with path.open(encoding='utf-8-sig', newline='') as file:
        reader = csv.reader(file)
        transcript = next(reader)[0]
        version = re.search(r'\((v[\d.]+)\)', transcript)
        assert version and f'https://hadeethenc.com/{language}' in transcript, 'Wrong publisher/edition'
        header = next(reader)
        assert header == ['id','title_ar','title','hadith_text_ar','hadith_text','explanation_ar','explanation','benefits_ar','benefits','grade_ar','takhrij_ar','grade','takhrij','lang','link'], 'Publisher schema changed'
        rows = {}
        for row in reader:
            assert len(row) == len(header), 'Malformed CSV row'
            value = dict(zip(header, row))
            assert value['id'] not in rows, 'Duplicate source ID'
            rows[value['id']] = value
    editions[language] = {'version': version[1], 'transcript': transcript,
        'downloadUrl': f'https://hadeethenc.com/en/browse/download/{language}/csv',
        'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    records[language] = rows
hadiths = []
for item in selection:
    translations = {}
    for language in ['en','ur']:
        record = records[language][item['id']]
        assert record['lang'] == language and record['hadith_text'] and record['hadith_text_ar']
        assert 'صحيح' in record['grade_ar'], 'Selected narration is not graded sahih'
        assert 'البخاري' in record['takhrij_ar'] or 'متفق عليه' in record['takhrij_ar'], 'Bukhari attribution missing'
        assert record['link'] == f"https://hadeethenc.com/{language}/browse/hadith/{item['id']}"
        translations[language] = record
    canonical = json.dumps(translations, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    hadiths.append({**item, 'bukhariUrl': f"https://sunnah.com/bukhari:{item['bukhari']}",
        'sourceRecordSha256': hashlib.sha256(canonical.encode()).hexdigest(), 'translations': translations})
bundle = {'schema': 1, 'checkedOn': args.checked_on,
    'publisher': 'HadeethEnc — Encyclopedia of Translated Prophetic Hadiths',
    'termsUrl': 'https://hadeethenc.com/en', 'editions': editions, 'hadiths': hadiths}
(repo / 'public/hadith.json').write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + '\n')
print(f'Imported {len(hadiths)} selected narrations with complete records and publisher notices.')
