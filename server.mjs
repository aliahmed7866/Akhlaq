import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { calculate, cities } from './prayer.mjs';
import { loadAssets } from './assets.mjs';

const run = promisify(execFile);
const host = '127.0.0.1';
const port = Number(process.env.PORT || 8786);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const assets = await loadAssets();

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy',
    "default-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; media-src 'self' https://d.quranenc.com https://cdn.islamic.network");
  if (![host + ':' + port, 'localhost:' + port].includes(request.headers.host)) {
    return json(response, 403, { error: 'Open Akhlaq on your phone’s loopback address.' });
  }
  const url = new URL(request.url, 'http://' + host);
  try {
    if (url.pathname === '/api/gps' && request.method === 'POST') {
      if (request.headers.origin !== 'http://' + request.headers.host) {
        return json(response, 403, { error: 'Open the Akhlaq app to request GPS.' });
      }
      try {
        const { stdout } = await run('termux-location', ['-p', 'gps', '-r', 'once'], {
          timeout: 20000, maxBuffer: 8192,
        });
        const { latitude, longitude } = JSON.parse(stdout);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
            || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          throw new Error('Invalid location');
        }
        return json(response, 200, { latitude, longitude });
      } catch {
        return json(response, 503, {
          error: 'Termux GPS is unavailable. Enable Android location for Termux:API, or use a city or coordinates.',
        });
      }
    }
    if (request.method !== 'GET') return json(response, 405, { error: 'Method unavailable.' });
    if (url.pathname === '/api/cities') return json(response, 200, cities);
    if (url.pathname === '/api/prayers') {
      return json(response, 200, calculate(url.searchParams));
    }
    const asset = assets.get(url.pathname);
    if (!asset) return json(response, 404, { error: 'Page unavailable.' });
    const headers = { 'Content-Type': asset.type };
    if (asset.compressed) {
      headers.Vary = 'Accept-Encoding';
      if (/(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers['accept-encoding'] || '')) {
        headers['Content-Encoding'] = 'gzip';
      }
    }
    response.writeHead(200, headers);
    response.end(headers['Content-Encoding'] ? asset.compressed : asset.body);
  } catch (error) {
    if (error instanceof RangeError) return json(response, 400, { error: error.message });
    console.error(error);
    json(response, 500, { error: 'Akhlaq could not load this request.' });
  }
});

server.listen(port, host, () => console.log('Akhlaq is running at http://' + host + ':' + port));
