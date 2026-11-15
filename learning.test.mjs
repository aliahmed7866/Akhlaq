import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { dailyIndex, normaliseSearch, cleanLearningPreferences } from './public/learning.js';
const hadith = JSON.parse(await readFile(new URL('./public/hadith.json', import.meta.url)));
const content = JSON.parse(await readFile(new URL('./public/learning-content.json', import.meta.url)));
const quran = JSON.parse(gunzipSync(await readFile(new URL('./data/quran.json.gz', import.meta.url))));
const canonical = value => JSON.stringify(value, (key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
test('selected hadiths preserve publisher records, editions, authenticity labels and checksums', () => {
  assert.equal(hadith.hadiths.length, 12);
  assert.equal(new Set(hadith.hadiths.map(h => h.id)).size, 12);
  for (const lang of ['en', 'ur']) {
    const edition = hadith.editions[lang];
    assert.ok(edition.transcript.includes(edition.version));
    assert.match(edition.sourceSha256, /^[0-9a-f]{64}$/);
    assert.equal(edition.downloadUrl, `https://hadeethenc.com/en/browse/download/${lang}/csv`);
  }
  for (const h of hadith.hadiths) {
    assert.equal(createHash('sha256').update(canonical(h.translations)).digest('hex'), h.sourceRecordSha256);
    assert.equal(h.bukhariUrl, `https://sunnah.com/bukhari:${h.bukhari}`);
    for (const lang of ['en', 'ur']) {
      const t = h.translations[lang];
      assert.equal(t.id, h.id); assert.equal(t.lang, lang);
      assert.match(t.grade_ar, /صحيح/); assert.match(t.takhrij_ar, /البخاري|متفق عليه/);
      assert.equal(t.link, `https://hadeethenc.com/${lang}/browse/hadith/${h.id}`);
      for (const key of ['hadith_text', 'hadith_text_ar', 'explanation', 'explanation_ar', 'grade', 'takhrij']) assert.ok(t[key]);
    }
  }
});
test('every practice and every story paragraph has valid bundled evidence', () => {
  for (const practice of content.practices) assert.ok(hadith.hadiths.some(h => h.id === practice.hadith));
  assert.equal(content.stories.length, 8);
  for (const story of content.stories) for (const part of story.parts) {
    assert.ok(part.references.length);
    for (const ref of part.references) {
      const chapter = quran.chapters[ref.chapter - 1];
      assert.ok(chapter && ref.from >= 1 && ref.to >= ref.from && ref.to <= chapter.ayahs.length);
    }
  }
});
test('learning search accepts English, Arabic and Urdu reference digits', () => {
  assert.equal(normaliseSearch(' ۶۱۱۴ '), '6114');
  assert.equal(normaliseSearch('٦١١٤'), '6114');
  assert.equal(normaliseSearch('اللَّه'), normaliseSearch('الله'));
  assert.equal(normaliseSearch(' KINDNESS '), 'kindness');
});
test('learning preferences reject obsolete IDs and malformed saved values', () => {
  assert.deepEqual(cleanLearningPreferences({language:'xx', saved:['5351','5351','bad',{}], routine:'read'}, hadith.hadiths, content.practices), {language:'en', saved:['5351'], routine:'read'});
  assert.deepEqual(cleanLearningPreferences(null, hadith.hadiths, content.practices), {language:'en', saved:[], routine:''});
});
test('daily selection is stable, bounded and rotates across a week', () => {
  const selections = Array.from({length:7}, (_, i) => dailyIndex(`2026-11-${15+i}`, 12));
  assert.equal(dailyIndex('2026-11-15', 12), selections[0]);
  assert.ok(selections.every(i => i >= 0 && i < 12));
  assert.ok(new Set(selections).size > 1);
  assert.equal(dailyIndex('', 0), 0);
});
