const source = 'https://quranenc.com/en/home/d/csv/urdu_junagarhi';
const limit = 6_000_000;

function csvRows(text) {
  // QuranEnc exports RFC 4180 CSV, including quoted multiline notices and notes.
  const token = /"((?:[^"]|"")*)"|([^",\r\n]*)(?=[,\r\n]|$)/y;
  let offset = 0;
  const rows = [];
  let row = [];
  while (offset < text.length) {
    token.lastIndex = offset;
    const field = token.exec(text);
    if (!field) throw new Error('Invalid Urdu CSV field');
    row.push(field[1] === undefined ? field[2] : field[1].replaceAll('""', '"'));
    offset = token.lastIndex;
    if (text[offset] === ',') {
      offset++;
      if (offset === text.length) row.push('');
      continue;
    }
    if (text[offset] === '\r') offset++;
    if (text[offset] === '\n') offset++;
    else if (offset !== text.length) throw new Error('Invalid Urdu CSV separator');
    rows.push(row);
    row = [];
  }
  if (row.length) rows.push(row);
  return rows;
}

export function parseUrduCsv(text, chapters) {
  const [notice, header, ...rows] = csvRows(text.replace(/^\uFEFF/, ''));
  const transcript = notice?.[0];
  const version = /\((v\d+\.\d+\.\d+-csv\.\d+)\)/.exec(transcript || '')?.[1];
  if (!version || !transcript.includes('urdu_junagarhi') || header?.join(',') !== 'id,sura,aya,translation,footnotes') {
    throw new Error('Unexpected Urdu edition');
  }
  const verses = [];
  for (const chapter of chapters) {
    for (const [index, [id]] of chapter.ayahs.entries()) {
      const row = rows[verses.length];
      if (row?.length !== 5 || row[0] !== String(id) || row[1] !== String(chapter.id)
          || row[2] !== String(index + 1) || !/\p{Script=Arabic}/u.test(row[3])) {
        throw new Error('Urdu edition has missing or mismatched verses');
      }
      verses.push([row[3], row[4]]);
    }
  }
  if (verses.length !== rows.length) throw new Error('Unexpected extra Urdu verses');
  return { version, transcript, verses };
}

export async function downloadUrdu(chapters) {
  const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new Error('Urdu publisher unavailable');
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > limit) throw new Error('Urdu edition exceeds download limit');
    chunks.push(chunk);
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total));
  return parseUrduCsv(text, chapters);
}
