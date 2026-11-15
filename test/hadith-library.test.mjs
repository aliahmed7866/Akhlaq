import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadHadithAssets } from '../hadith-assets.mjs';
const canonical = value => JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, typeof value[key] === 'object' ? JSON.parse(canonical(value[key])) : value[key]])));
const sha = value => createHash('sha256').update(value).digest('hex');

test('all 1018 offline hadith records preserve complete EN/UR publisher fields, hashes and actual attribution', async () => {
  const assets = await loadHadithAssets();
  const index = JSON.parse(assets.get('/hadith-index.json').body);
  const featured = JSON.parse(await readFile(new URL('../public/hadith.json', import.meta.url)));
  assert.equal(index.hadiths.length, 1018);
  assert.equal(new Set(index.hadiths.map(h => h.id)).size, 1018);
  assert.equal(index.hadiths.filter(h => h.featured).length, 12);
  assert.deepEqual(index.editions, featured.editions);
  let count = 0;
  for (const [chunk, meta] of Object.entries(index.chunks)) {
    const body = assets.get('/hadith/' + chunk + '.json').body;
    assert.equal(sha(body), meta.sha256);
    const bundle = JSON.parse(body);
    assert.deepEqual(bundle.editions, index.editions);
    assert.equal(bundle.hadiths.length, meta.count);
    for (const row of bundle.hadiths) {
      count++;
      const entry = index.hadiths.find(h => h.id === row.id);
      assert.equal(entry.chunk, chunk);
      assert.equal(row.sourceRecordSha256, sha(canonical(row.translations)));
      assert.equal(entry.sourceRecordSha256, row.sourceRecordSha256);
      for (const language of ['en', 'ur']) {
        const record = row.translations[language];
        assert.equal(Object.keys(record).length, 15);
        assert.equal(record.id, row.id);
        assert.equal(record.lang, language);
        assert.equal(record.grade_ar, 'صحيح');
        if (!entry.featured) assert.ok(['رواه البخاري', 'متفق عليه'].includes(record.takhrij_ar));
        assert.equal(record.link, `https://hadeethenc.com/${language}/browse/hadith/${row.id}`);
        assert.equal(record.title, entry.titles[language]);
        assert.ok(record.hadith_text && record.hadith_text_ar);
        assert.equal(typeof record.explanation, "string");
      }
      if (entry.featured) assert.deepEqual(row.translations, featured.hadiths.find(h => h.id === row.id).translations);
      else assert.equal(entry.bukhari, null, 'Never fabricate a Bukhari number from a publisher ID');
    }
  }
  assert.equal(count, index.hadiths.length);
});
