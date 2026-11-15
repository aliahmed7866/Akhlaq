import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAssets } from '../assets.mjs';
import { makeCalendar } from '../public/calendar.js';
import { readHeading, smoothHeading, turnAngle, createHeadingTracker, createAlignmentCue } from '../public/compass.js';
import { validateBackup } from '../public/practice.js';
import { calculate } from '../prayer.mjs';

const almost = (value, expected) => assert.ok(Math.abs(value - expected) < 0.01, value + ' ≈ ' + expected);
const sample = { absolute: true, alpha: 330, beta: 0, gamma: 0 };

test('compass uses magnetic correction and projects the top edge in landscape', () => {
  almost(readHeading(sample, 0, 2).heading, 32);
  almost(readHeading(sample, 90, -2).heading, 118);
  almost(readHeading({ ...sample, beta: 25 }, 0, 2).heading, 32);
  assert.deepEqual(readHeading({ ...sample, beta: 30, gamma: 25 }, 90, 0), { issue: 'tilt' });
  almost(readHeading({ ...sample, gamma: 25 }, 90, 0).heading, 120);
  assert.deepEqual(readHeading({ ...sample, beta: 89 }, 0, 0), { issue: 'tilt' });
  assert.deepEqual(readHeading(sample, 0, null), { issue: 'correction' });
  assert.equal(readHeading({ ...sample, absolute: false }, 0, 0), null);
  const native = { ...sample, absolute: false, webkitCompassHeading: 28, webkitCompassAccuracy: 5 };
  almost(readHeading(native, 0, 2).heading, 30);
  assert.deepEqual(readHeading({ ...native, webkitCompassAccuracy: 30 }, 0, 2), { issue: 'calibration' });
});

test('compass turns and smoothing cross north by the shorter arc', () => {
  assert.equal(turnAngle(358, 2), 4);
  assert.equal(turnAngle(2, 358), -4);
  assert.equal(turnAngle(80, 46), -34);
  assert.equal(smoothHeading(358, 2, 0.5), 360);
  assert.equal(smoothHeading(2, 358, 0.5), 0);
});

test('calendar exports future selected prayers with UTC times and reminders', () => {
  const date = '2026-11-14';
  const now = new Date(date + 'T13:00:00Z');
  const result = makeCalendar([{ date, times: {
    fajr: date + 'T05:53:00Z', asr: date + 'T14:23:00Z', maghrib: date + 'T16:17:00Z',
  } }], [['fajr', 'Fajr'], ['asr', 'Asr']], 'Town, UK; ' + 'ش'.repeat(65), 10, now);
  assert.equal(result.match(/BEGIN:VEVENT/g).length, 1);
  assert.match(result, /DTSTART:20261114T142300Z\r\n/);
  assert.match(result, /TRIGGER:-PT10M/);
  assert.ok(result.includes('Town\\, UK\\;'));
  assert.ok(result.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  assert.ok(result.endsWith('END:VCALENDAR\r\n'));
});

test('backups preserve previous-format logs and only import supported counter values', () => {
  const entries = {
    '2026-11-13': { fajr: true, reflection: 'A note.' },
    '2026-11-14': { counters: { subhanallah: { count: 33, goal: 33 }, alhamdulillah: { count: 4, goal: -1 } } },
  };
  const [old, current] = validateBackup({ version: 1, entries }, ['fajr']);
  assert.deepEqual(old, ['2026-11-13', { fajr: true, reflection: 'A note.', counters: {} }]);
  assert.deepEqual(current[1].counters, { subhanallah: { count: 33, goal: 33 } });
  assert.throws(() => validateBackup({ version: 1, entries: { '2026-02-30': {} } }, ['fajr']));
});

test('offline package contains install assets and the same prayer engine as Termux', async () => {
  const assets = await loadAssets();
  const manifest = JSON.parse(assets.get('/manifest.webmanifest').body);
  const worker = assets.get('/sw.js').body;
  assert.equal(manifest.display, 'standalone');
  assert.ok(assets.has(manifest.start_url));
  for (const icon of manifest.icons) {
    const image = assets.get(icon.src).body;
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(image.readUInt32BE(16), width);
    assert.equal(image.readUInt32BE(20), height);
    assert.ok(worker.includes(JSON.stringify(icon.src)));
  }
  for (const path of ['/engine.js', '/location.js', '/interface.js', '/app.js', '/compass.js', '/practice.js', '/calendar.js', '/install.js', '/quran.js', '/player-view.js', '/media-session.js', '/quran.json']) {
    assert.ok(assets.has(path) && worker.includes(JSON.stringify(path)));
  }
  assert.ok(!worker.includes('/api/gps'));
  const engine = await import('data:text/javascript;base64,' + assets.get('/engine.js').body.toString('base64'));
  const query = new URLSearchParams('lat=53.4808&lon=-2.2426&zone=Europe%2FLondon');
  const now = new Date('2026-11-14T12:00:00Z');
  assert.deepEqual(engine.calculate(query, now), calculate(query, now));
  const { distanceKm } = engine.calculate(query, now);
  assert.ok(distanceKm > 4900 && distanceKm < 5400);
});


test('native compass uses reported angular error and rejects poor quality or magnetic interference', () => {
  const event = { magneticHeading: 358, beta: 0, gamma: 0, accuracyStatus: 3, headingAccuracy: 6, magneticStrength: 48 };
  assert.deepEqual(readHeading(event, 0, 4, 49), { heading: 2, accuracy: 6 });
  assert.equal(readHeading({ ...event, headingAccuracy: null }, 0, 4).accuracy, null);
  assert.equal(readHeading({ ...event, accuracyStatus: 1 }, 0, 4).issue, 'calibration');
  assert.equal(readHeading({ ...event, headingAccuracy: 28 }, 0, 4).issue, 'calibration');
  assert.equal(readHeading({ ...event, magneticStrength: 95 }, 0, 4, 49).issue, 'interference');
  assert.equal(readHeading({ ...event, gamma: 50 }, 0, 4).issue, 'tilt');
  assert.equal(readHeading({ issue: 'unsupported' }, 0, 4).issue, 'unsupported');
});

test('direction confirmation requires fresh samples over time, handles north, and rejects jitter', () => {
  const tracker = createHeadingTracker();
  for (let i = 0; i < 8; i++) assert.equal(tracker.update(i % 2 ? 359 : 1, i * 100), false);
  assert.equal(tracker.update(0, 800), true);
  assert.equal(tracker.update(25, 900), false);
  tracker.reset();
  for (let i = 0; i < 12; i++) assert.equal(tracker.update(i % 2 ? 350 : 10, i * 100), false);
  assert.equal(tracker.update(0, 3000), false, 'a gap cannot preserve confirmation');
  assert.equal(tracker.update(0, 3000), false, 'duplicate timestamps cannot count as steady time');
});


test('Qibla buzz fires once per confirmed approach and ignores jitter or unreliable readings', () => {
  const cue = createAlignmentCue();
  const sample = (now, turn, aligned = false, reliable = true) => cue.update({now, turn, aligned, reliable});
  assert.equal(sample(0, 0), false);
  assert.equal(sample(800, 0, true), true);
  for (let at = 900; at < 5000; at += 100) assert.equal(sample(at, at % 200 ? 3 : 5, true), false);
  assert.equal(sample(5000, 30, false, false), false);
  assert.equal(sample(5100, 0, true), false);
  for (let at = 5200; at <= 5900; at += 100) assert.equal(sample(at, 20), false);
  assert.equal(sample(6800, 0, true), true);
  assert.equal(sample(6900, 0, true), false);
  cue.reset();
  assert.equal(sample(7000, 0, true, false), false);
  assert.equal(sample(8000, 0, true), true);
});
