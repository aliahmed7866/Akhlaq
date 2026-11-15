import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { downloadUrdu } from '../urdu.mjs';
import { gunzipSync, gzipSync } from 'node:zlib';
const output = new URL('../android/app/build/generated/assets/', import.meta.url);
await mkdir(output, { recursive: true });
await cp(new URL('../public/', import.meta.url), output, { recursive: true });
try { await readFile(new URL('../data/urdu.json.gz', import.meta.url)); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const quran = JSON.parse(gunzipSync(await readFile(new URL('../data/quran.json.gz', import.meta.url))));
  const edition = await downloadUrdu(quran.chapters);
  await writeFile(new URL('../data/urdu.json.gz', import.meta.url), gzipSync(JSON.stringify(edition)));
}
for (const name of ['quran', 'urdu']) {
  const body = gunzipSync(await readFile(new URL('../data/' + name + '.json.gz', import.meta.url)));
  JSON.parse(body);
  await writeFile(new URL(name + '.json', output), body);
}
console.log('Bundled app, calculation engine, Quran and Urdu translation.');

const raw = new URL('../android/app/build/generated/res/raw/', import.meta.url);
await mkdir(raw, { recursive: true });
await cp(new URL('../public/adhan.oga', import.meta.url), new URL('adhan.ogg', raw));
