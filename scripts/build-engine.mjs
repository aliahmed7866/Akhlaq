import { fileURLToPath } from 'node:url';
import { build } from 'esbuild-wasm';

const project = fileURLToPath(new URL('../', import.meta.url));
await build({
  absWorkingDir: project,
  entryPoints: ['prayer.mjs'],
  outfile: 'public/engine.js',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'inline',
});
