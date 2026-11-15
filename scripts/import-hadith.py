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

# Expand browsing only from exact publisher grades/attributions present in BOTH editions.
# Numbered Bukhari cross-references remain limited to the reviewed selection above.
import gzip
reviewed = {item['id']: item for item in selection}
eligible = [id for id in records['en'] if id in records['ur'] and all(
    records[language][id]['grade_ar'] == 'صحيح'
    and records[language][id]['takhrij_ar'] in ('رواه البخاري', 'متفق عليه')
    for language in ['en', 'ur'])]
# Two reviewed entries combine parallel narrations and have longer publisher attributions.
# Their existing numbered cross-checks and complete wording are retained above.
ordered = list(reviewed) + sorted(set(eligible) - set(reviewed), key=int)
folder = repo / 'data/hadith'
folder.mkdir(parents=True, exist_ok=True)
index = {'schema': 1, 'checkedOn': args.checked_on, 'editions': editions, 'chunks': {}, 'hadiths': []}
for offset in range(0, len(ordered), 64):
    chunk = f'{offset // 64 + 1:02}'
    entries = []
    for id in ordered[offset:offset+64]:
        translations = {language: records[language][id] for language in ['en','ur']}
        for language, record in translations.items():
            assert record['lang'] == language and record['hadith_text'] and record['hadith_text_ar']
            assert record['link'] == f'https://hadeethenc.com/{language}/browse/hadith/{id}'
        canonical = json.dumps(translations, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        metadata = reviewed.get(id, {})
        index['hadiths'].append({'id': id, 'chunk': chunk, 'featured': id in reviewed,
            'label': metadata.get('label', translations['en']['title']),
            'titles': {'en': translations['en']['title'], 'ur': translations['ur']['title'], 'ar': translations['en']['title_ar']},
            'topic': metadata.get('topic', ''), 'bukhari': metadata.get('bukhari'),
            'collection': 'Bukhari & Muslim' if all(r['takhrij_ar'] == 'متفق عليه' for r in translations.values()) else 'Bukhari',
            'sourceRecordSha256': digest})
        entries.append({'id': id, 'sourceRecordSha256': digest, 'translations': translations})
    body = json.dumps({'schema':1, 'editions':editions, 'hadiths':entries}, ensure_ascii=False, separators=(',',':')).encode()
    (folder / f'{chunk}.json.gz').write_bytes(gzip.compress(body, mtime=0))
    index['chunks'][chunk] = {'count':len(entries), 'sha256':hashlib.sha256(body).hexdigest()}
(repo / 'data/hadith-index.json.gz').write_bytes(gzip.compress(json.dumps(index, ensure_ascii=False, separators=(',',':')).encode(), mtime=0))
# Only remove obsolete generated chunks from this exact output folder.
for file in folder.glob('*.json.gz'):
    if file.name.removesuffix('.json.gz') not in index['chunks']: file.unlink()
print(f'Bundled {len(ordered)} publisher-graded sahih Bukhari-attributed records in {len(index["chunks"])} offline chunks.')
