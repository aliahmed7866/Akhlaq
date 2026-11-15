import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { findVerses } from '../public/quran.js';
import { matchesHadith, normaliseSearch } from '../public/learning.js';
import { audioClock } from '../public/player-view.js';

test('Quran search returns all matching verses beyond the previous first-15 boundary', async () => {
  const {chapters} = JSON.parse(gunzipSync(await readFile(new URL('../data/quran.json.gz', import.meta.url))));
  const all = findVerses(chapters, 'Allah');
  assert.ok(all.length > 1000);
  assert.ok(all.some(hit => hit.chapter > 100));
  assert.deepEqual(findVerses(chapters, 'Allah', undefined, 15), all.slice(0,15));
  assert.equal(new Set(all.map(h=>h.chapter+':'+h.verse)).size, all.length);
});
test('hadith reference namespaces never invent Bukhari numbers from publisher IDs', () => {
  const h = {id:'5351', bukhari:5027};
  for (const query of ['HadeethEnc 5351','hadithenc: ۵۳۵۱','Bukhari # ٥٠٢٧','005351']) assert.ok(matchesHadith(h, query, ''));
  assert.equal(matchesHadith(h, 'Bukhari 5351', ''), false);
  assert.equal(matchesHadith({id:'1', bukhari:null}, 'Bukhari 1', ''), false);
  assert.equal(matchesHadith(h, 'HadeethEnc 5027', ''), false);
});
test('hadith words match in any order across Arabic and Urdu forms', () => {
  assert.ok(matchesHadith({}, 'kindness parents', normaliseSearch('Showing kindness to your parents')));
  assert.ok(matchesHadith({}, 'ذكر الله', normaliseSearch('اللہ کا ذکر')));
  assert.equal(matchesHadith({}, 'kindness neighbour', normaliseSearch('Showing kindness to your parents')), false);
});
test('listening position labels remain readable for unknown and long durations', () => {
  assert.equal(audioClock(NaN), '0:00'); assert.equal(audioClock(-1), '0:00');
  assert.equal(audioClock(65.9), '1:05'); assert.equal(audioClock(3661), '61:01');
});
