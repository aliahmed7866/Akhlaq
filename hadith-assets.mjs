import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

export async function loadHadithAssets() {
  const type = 'application/json; charset=utf-8';
  const compressed = await readFile(new URL('./data/hadith-index.json.gz', import.meta.url));
  const body = gunzipSync(compressed);
  const index = JSON.parse(body);
  const assets = new Map([['/hadith-index.json', { body, compressed, type }]]);
  for (const chunk of Object.keys(index.chunks)) {
    if (!/^\d{2}$/.test(chunk)) throw Error('Invalid hadith chunk');
    const compressed = await readFile(new URL('./data/hadith/' + chunk + '.json.gz', import.meta.url));
    assets.set('/hadith/' + chunk + '.json', {body:gunzipSync(compressed), compressed, type});
  }
  return assets;
}
