import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUrduCsv } from '../urdu.mjs';
import { findVerses, verseReference } from '../public/quran.js';

const chapters = [
  { id: 1, ayahs: [[1, 'ٱلْحَمْدُ لِلَّهِ', 'All praise[1] be to Allah.']] },
  { id: 2, ayahs: [[2, 'بِسْمِ ٱللَّهِ', 'In the name of Allah.']] },
];
const sample = [
  '"Transcript\r\n# Translation ID: urdu_junagarhi\r\n# Last update (v1.1.3-csv.1)",,,,',
  'id,sura,aya,translation,footnotes',
  '1,1,1,"تمام تعریفیں","a ""quote"", then\r\na new line"',
  '2,2,1,اللہ کے نام سے,',
].join('\r\n');

test('Urdu import preserves the publisher transcript, text and multiline notes', () => {
  const result = parseUrduCsv('\uFEFF' + sample, chapters);
  assert.equal(result.version, 'v1.1.3-csv.1');
  assert.match(result.transcript, /\r\n# Translation ID: urdu_junagarhi/);
  assert.deepEqual(result.verses, [['تمام تعریفیں', 'a "quote", then\r\na new line'], ['اللہ کے نام سے', '']]);
});

test('Urdu import rejects the wrong edition, missing rows and verse mismatches', () => {
  assert.throws(() => parseUrduCsv(sample.replace('urdu_junagarhi', 'english_rwwad'), chapters));
  assert.throws(() => parseUrduCsv(sample.split('\r\n').slice(0, -1).join('\r\n'), chapters));
  assert.throws(() => parseUrduCsv(sample.replace('2,2,1', '2,1,2'), chapters));
});

test('search accepts Urdu and Arabic references and matches phrases without changing displayed text', () => {
  assert.deepEqual(verseReference('۲:۱', chapters), { chapter: 2, verse: 1 });
  assert.deepEqual(verseReference('١:١', chapters), { chapter: 1, verse: 1 });
  const urdu = parseUrduCsv(sample, chapters);
  assert.deepEqual(findVerses(chapters, 'تعریفیں', urdu), [{ chapter: 1, verse: 1, lang: 'ur', text: 'تمام تعریفیں' }]);
  assert.equal(findVerses(chapters, 'الحمد', urdu)[0].lang, 'ar');
  assert.equal(findVerses(chapters, 'praise be to Allah', urdu)[0].lang, 'en');
});
