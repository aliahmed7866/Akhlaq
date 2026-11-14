import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const types = {
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  svg: 'image/svg+xml',
  webmanifest: 'application/manifest+json; charset=utf-8',
};
const paths = [
  'index.html', 'app.js', 'style.css', 'compass.js', 'practice.js', 'calendar.js', 'install.js',
  'quran.js', 'engine.js', 'manifest.webmanifest', 'icons/akhlaq.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
const load = path => readFile(new URL('./public/' + path, import.meta.url));

export async function loadAssets() {
  const [worker, files, quran] = await Promise.all([
    load('sw.js'),
    Promise.all(paths.map(async path => [
      path === 'index.html' ? '/' : '/' + path,
      { body: await load(path), type: types[path.split('.').at(-1)] },
    ])),
    readFile(new URL('./data/quran.json.gz', import.meta.url)),
  ]);
  const assets = new Map(files);
  assets.set('/quran.json', { body: gunzipSync(quran), compressed: quran, type: types.json });
  const hash = createHash('sha256').update(worker);
  for (const [path, { body }] of assets) hash.update(path).update(body);
  assets.set('/sw.js', {
    type: types.js,
    body: 'const AKHLAQ_REVISION = ' + JSON.stringify(hash.digest('hex').slice(0, 24))
      + '; const AKHLAQ_ASSETS = ' + JSON.stringify([...assets.keys()]) + ';\n' + worker,
  });
  return assets;
}
