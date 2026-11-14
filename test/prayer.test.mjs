import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculate, dateInZone } from '../prayer.mjs';

const now = new Date('2026-11-14T12:00:00Z');
const query = (params = {}) => new URLSearchParams({
  lat: '53.4808', lon: '-2.2426', zone: 'Europe/London', ...params,
});

test('Manchester Qibla, seven days and winter prayer calculation', () => {
  const result = calculate(query(), now);
  assert.equal(result.today, '2026-11-14');
  assert.equal(result.days.length, 7);
  assert.equal(result.days[6].date, '2026-11-20');
  assert.equal(result.previous.date, '2026-11-13');
  assert.ok(Math.abs(result.bearing - 118.45) < 0.1);
  assert.ok(Math.abs(result.declination) < 2);
  assert.equal(result.days[0].times.fajr, '2026-11-14T05:53:00.000Z');
  assert.equal(result.days[0].times.maghrib, '2026-11-14T16:17:00.000Z');
});

test('Manchester summer twilight and alternate Asr and mosque adjustments', () => {
  const date = '2026-06-21';
  const base = calculate(query({ date }), now).days[0].times;
  const standard = calculate(query({ date, madhab: 'standard', offsets: '5,0,0,0,0,0' }), now).days[0].times;
  assert.ok(Object.values(base).every(Boolean));
  assert.ok(base.fajr < base.sunrise);
  assert.ok(base.maghrib < base.isha);
  assert.ok(base.asr > standard.asr);
  assert.equal(Date.parse(standard.fajr) - Date.parse(base.fajr), 5 * 60000);
  assert.equal(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
  }).format(new Date(base.maghrib)), '21:45');
});

test('local calendar day and date line use the selected time zone', () => {
  const result = calculate(query({
    lat: '1.87', lon: '-157.4', zone: 'Pacific/Kiritimati',
  }), new Date('2026-11-13T12:00:00Z'));
  assert.equal(result.today, '2026-11-14');
  for (const time of Object.values(result.days[0].times)) {
    assert.equal(dateInZone(new Date(time), result.zone), '2026-11-14');
  }
});

test('unavailable polar events and invalid inputs are explicit', () => {
  const result = calculate(query({
    lat: '78.2', lon: '15.6', zone: 'Arctic/Longyearbyen', date: '2026-06-21',
  }), now);
  assert.equal(result.days[0].times.fajr, null);
  assert.equal(result.days[0].times.maghrib, null);
  for (const params of [
    { lat: '' }, { lon: 181 }, { zone: 'Manchester' }, { date: '2026-02-29' },
    { method: '__proto__' }, { madhab: 'other' }, { offsets: '1,2,3' },
  ]) assert.throws(() => calculate(query(params), now), RangeError);
});
