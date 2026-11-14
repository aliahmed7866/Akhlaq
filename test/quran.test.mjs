import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { audioUrl, dailyVerse, readingBookmarks, verseReference } from '../public/quran.js';

const quran = JSON.parse(gunzipSync(await readFile(new URL('../data/quran.json.gz', import.meta.url))));
const { chapters } = quran;

test('Quran package includes all numbered verses with source notices', () => {
  assert.equal(chapters.length, 114);
  let verse = 0;
  chapters.forEach((chapter, index) => {
    assert.equal(chapter.id, index + 1);
    for (const [number, arabic, english, notes] of chapter.ayahs) {
      assert.equal(number, ++verse);
      assert.ok(arabic && english);
      assert.equal(typeof notes, 'string');
    }
  });
  assert.equal(verse, 6236);
  assert.match(quran.englishTranscript, /english_rwwad/);
  assert.match(quran.englishTranscript, new RegExp(quran.englishVersion.replaceAll('.', '\\.')));
  assert.match(quran.arabicNotice, /Tanzil Quran Text/);
  assert.ok(chapters[0].ayahs[1][3]);
});

test('daily verse is stable for the selected date and changes the next day', () => {
  const today = dailyVerse(chapters, '2026-11-14');
  assert.deepEqual(dailyVerse(chapters, '2026-11-14'), today);
  assert.notDeepEqual(dailyVerse(chapters, '2026-11-15'), today);
  assert.ok(chapters[today.chapter - 1].ayahs[today.verse - 1]);
});

test('verse lookup checks chapter boundaries and each audio source uses its numbering', () => {
  assert.deepEqual(verseReference('2 : 255', chapters), { chapter: 2, verse: 255 });
  assert.deepEqual(verseReference('114:6', chapters), { chapter: 114, verse: 6 });
  for (const ref of ['0:1', '114:7', '115:1', '1:0']) assert.equal(verseReference(ref, chapters), null);
  assert.match(audioUrl('english', 2, 1, 8), /english_rwwad\/002001\.mp3$/);
  assert.match(audioUrl('arabic', 2, 1, 8), /ar\.alafasy\/8\.mp3$/);
});

test('saved verses migrate a legacy bookmark and validate and deduplicate references', () => {
  const first = { chapter: 2, verse: 255 };
  const second = { chapter: 114, verse: 6 };
  assert.deepEqual([...readingBookmarks({ bookmark: first }, chapters).values()], [first]);
  assert.deepEqual([...readingBookmarks({
    bookmark: first, bookmarks: [first, first, second, { chapter: 114, verse: 7 }, null],
  }, chapters).values()], [first, second]);
  assert.equal(readingBookmarks({ bookmark: first, bookmarks: [] }, chapters).size, 0);
});
