import { calculate } from './engine.js';
import { setupCompass } from './compass.js';
import { setupPractice } from './practice.js';
import { downloadFile, makeCalendar } from './calendar.js';
import { setupQuran } from './quran.js';
import { setupInstall } from './install.js';
import { setupLearning } from './learning.js';
import { setupCompanion } from './companion.js';

const byId = id => document.getElementById(id);
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault(); byId('main-content').focus();
});
if (window.AkhlaqNative?.version) {
  byId('app-version').textContent = 'Akhlaq · ' + window.AkhlaqNative.version();
}
if (window.AkhlaqNative?.eraseData) {
  byId('native-data-controls').hidden = false;
  byId('erase-app-data').addEventListener('click', () => window.AkhlaqNative.eraseData());
}
const prayers = [
  ['fajr', 'Fajr'], ['sunrise', 'Sunrise'], ['dhuhr', 'Dhuhr'],
  ['asr', 'Asr'], ['maghrib', 'Maghrib'], ['isha', 'Isha'],
];
const salah = prayers.filter(([key]) => key !== 'sunrise');
const defaults = {
  city: 'Manchester', latitude: 53.4808, longitude: -2.2426, zone: 'Europe/London',
  method: 'MoonsightingCommittee', madhab: 'hanafi', highLatitude: 'default', offsets: Array(6).fill(0),
};
const settingsKey = 'akhlaq.settings.v1';
const form = byId('settings-form');
const settingsStatus = byId('settings-status');
const dateFormatters = new Map();
const calendar = byId('calendar-form');
const calendarButton = calendar.querySelector('[type=submit]');
let settings = { ...defaults, ...stored(settingsKey) };
let schedule;
let clock;
const renderCompass = setupCompass();
const quran = setupQuran({ stored, save, today: todayForPractice });
const practiceLog = setupPractice({ salah, stored, save, todayForPractice, shiftDate, dateLabel });
const learning = setupLearning({ stored, save, today: todayForPractice });
const companion = setupCompanion({ stored, save, today: todayForPractice, getSettings: () => settings, calculate });
const textSize = byId('app-text-size');
const savedSize = stored('akhlaq.comfort.v1').textSize;
textSize.value = [100, 125, 150, 200].includes(savedSize) ? String(savedSize) : '100';
function applyTextSize() { document.documentElement.style.fontSize = (16 * Number(textSize.value) / 100) + 'px'; }
applyTextSize();
textSize.addEventListener('change', () => {
  applyTextSize();
  byId('comfort-status').textContent = save('akhlaq.comfort.v1', { textSize: Number(textSize.value) }) ? 'Text size saved.' : 'Applied for now; your device could not save this preference.';
});
const measureOverlays = () => {
  const nav = document.querySelector('.tab-bar');
  const player = byId('quran-player');
  document.documentElement.style.setProperty('--nav-height', nav.getBoundingClientRect().height + 'px');
  document.documentElement.style.setProperty('--player-height', player.hidden ? '0px' : player.getBoundingClientRect().height + 'px');
};
if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(measureOverlays);
  observer.observe(document.querySelector('.tab-bar')); observer.observe(byId('quran-player'));
}
measureOverlays();

function stored(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The local server could not complete the request.');
  return data;
}

function shiftDate(date, amount) {
  const day = new Date(date + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() + amount);
  return day.toISOString().slice(0, 10);
}

function dateLabel(date, long = false) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: long ? 'long' : 'short', month: long ? 'long' : 'short',
    day: 'numeric', ...(long && { year: 'numeric' }),
  }).format(new Date(date + 'T12:00:00Z'));
}

function timeLabel(time) {
  return time ? clock.format(new Date(time)) : '—';
}

function fillForm() {
  for (const name of ['city', 'latitude', 'longitude', 'zone', 'method', 'madhab', 'highLatitude']) {
    form.elements[name].value = settings[name];
  }
  prayers.forEach(([key], index) => { form.elements['offset-' + key].value = settings.offsets[index]; });
  updateMethodNote();
}

function updateMethodNote() {
  byId('high-latitude-note').hidden = form.elements.method.value !== 'MoonsightingCommittee';
}

function requestSchedule(selection) {
  const query = new URLSearchParams({
    lat: selection.latitude, lon: selection.longitude, zone: selection.zone, method: selection.method,
    madhab: selection.madhab, highLatitude: selection.highLatitude, offsets: selection.offsets.join(','),
  });
  return calculate(query);
}

function showSchedule(data) {
  const previous = schedule?.today;
  schedule = data;
  clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  byId('prayer-error').hidden = true;
  byId('today-label').textContent = dateLabel(schedule.today, true);
  try {
    const hijri = new Intl.DateTimeFormat('en-GB-u-ca-islamic-civil', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(schedule.today + 'T12:00:00Z'));
    byId('hijri-date').textContent = hijri + ' · estimated';
  } catch {
    byId('hijri-date').textContent = '';
  }
  byId('location-freshness').textContent = settings.locatedAt ? 'Location checked ' + new Date(settings.locatedAt).toLocaleString() + '. Refresh after travelling; check your device time zone.' : 'Example location only. Use location access to get times for where you are.';
  companion.refresh(data);
  byId('schedule-location').textContent = (settings.city || 'Custom location') + ' · ' + schedule.zone.replaceAll('_', ' ');
  const select = form.elements.method;
  const method = Array.from(select.options).find(option => option.value === settings.method).textContent;
  byId('prayer-method').textContent = method + ' · ' + (settings.madhab === 'hanafi' ? 'Hanafi' : 'Standard') + ' Asr · Local start times';
  byId('unavailable').hidden = schedule.days.every(day => Object.values(day.times).every(Boolean));

  byId('prayers').replaceChildren(...prayers.map(([key, label]) => {
    const item = document.createElement('li');
    item.dataset.prayer = key;
    const time = document.createElement('strong');
    time.textContent = timeLabel(schedule.days[0].times[key]);
    item.append(label, time);
    if (key !== 'sunrise') {
      const log = document.createElement('button');
      log.className = 'quick-log';
      log.type = 'button';
      log.dataset.logPrayer = key;
      log.setAttribute('aria-label', 'Log ' + label);
      log.addEventListener('click', () => practiceLog.toggleTodayPrayer(key));
      item.append(log);
    }
    return item;
  }));
  const table = byId('week');
  table.tHead?.remove();
  const head = table.createTHead().insertRow();
  for (const label of ['Date', ...prayers.map(([, name]) => name)]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    head.append(th);
  }
  table.tBodies[0]?.remove();
  const body = table.createTBody();
  for (const day of schedule.days) {
    const row = body.insertRow();
    row.insertCell().textContent = dateLabel(day.date);
    prayers.forEach(([key]) => { row.insertCell().textContent = timeLabel(day.times[key]); });
  }
  updateCountdown();
  renderCompass(data);
  calendarButton.disabled = false;
  if (previous !== data.today) {
    practiceLog.refresh();
    quran.showDaily();
    learning.refreshDaily();
  } else {
    practiceLog.renderTodayLog();
  }
}

function updateCountdown() {
  if (!schedule) return;
  const now = Date.now();
  const upcoming = [schedule.previous, ...schedule.days].flatMap(({ times, date: prayerDay }) => salah.flatMap(([key, label]) => {
    if (!times[key]) return [];
    return [{ key, label, prayerDay, time: Date.parse(times[key]) }];
  })).filter(({ time }) => time > now).sort((a, b) => a.time - b.time)[0];
  const minutes = upcoming ? Math.ceil((upcoming.time - now) / 60000) : 0;
  const date = upcoming ? dateInZoneFor(new Date(upcoming.time), schedule.zone) : null;
  byId('next-name').textContent = upcoming?.label || '—';
  byId('next-label').textContent = date && date !== schedule.today
    ? 'Next prayer · ' + (date === shiftDate(schedule.today, 1) ? 'Tomorrow' : dateLabel(date))
    : 'Next prayer';
  byId('next-time').textContent = timeLabel(upcoming?.time);
  byId('countdown').textContent = minutes ? 'in ' + (minutes >= 60 ? Math.floor(minutes / 60) + 'h ' : '') + minutes % 60 + 'm' : '';
  for (const item of byId('prayers').children) {
    item.toggleAttribute('aria-current', upcoming?.prayerDay === schedule.today && item.dataset.prayer === upcoming?.key);
    if (item.hasAttribute('aria-current')) item.setAttribute('aria-current', 'true');
  }
}

function dateInZoneFor(instant, zone) {
  if (!dateFormatters.has(zone)) {
    dateFormatters.set(zone, new Intl.DateTimeFormat('en', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }));
  }
  const formatter = dateFormatters.get(zone);
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join('-');
}

function findLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Browser location unavailable'));
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve(coords), reject,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}

function readSettings() {
  return {
    city: byId('city').value, locatedAt: Number(byId('city').dataset.locatedAt || 0),
    latitude: form.elements.latitude.valueAsNumber,
    longitude: form.elements.longitude.valueAsNumber,
    zone: form.elements.zone.value.trim(), method: form.elements.method.value,
    madhab: form.elements.madhab.value, highLatitude: form.elements.highLatitude.value,
    offsets: prayers.map(([key]) => form.elements['offset-' + key].valueAsNumber || 0),
  };
}

function applySettings() {
  const invalid = form.querySelector(':invalid:not(fieldset)');
  if (invalid) {
    openField(invalid);
    invalid.reportValidity();
    return;
  }
  const selection = readSettings();
  try {
    const data = requestSchedule(selection);
    settings = selection;
    const saved = save(settingsKey, settings);
    showSchedule(data);
    settingsStatus.textContent = saved ? 'Settings saved.' : 'Settings applied for this session. Browser storage is unavailable.';
  } catch (error) {
    settingsStatus.textContent = error.message;
  }
}

byId('home-gps').addEventListener('click', () => byId('gps').click());
byId('gps').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  settingsStatus.textContent = 'Getting your location…';
  try {
    const { latitude, longitude } = await findLocation().catch(async () => {
      if (window.AkhlaqNative) throw new Error('Location unavailable. Allow location for Akhlaq in Android settings.');
      try {
        return await fetchJson('/api/gps', { method: 'POST', signal: AbortSignal.timeout(22000) });
      } catch (error) {
        if (error instanceof TypeError || error.name === 'TimeoutError') {
          throw new Error('Browser GPS is unavailable. Start Termux for its GPS fallback.');
        }
        throw error;
      }
    });
    byId('city').value = 'My location';
    byId('city').dataset.locatedAt = String(Date.now());
    form.elements.latitude.value = latitude;
    form.elements.longitude.value = longitude;
    form.elements.zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    applySettings();
  } catch (error) {
    settingsStatus.textContent = error.message + ' You can retry location access or enter coordinates under Location details.';
  } finally {
    button.disabled = false;
    byId('location-freshness').textContent = settingsStatus.textContent + ' Refresh location after travelling.';
  }
});

for (const name of ['latitude', 'longitude', 'zone']) {
  form.elements[name].addEventListener('input', () => { byId('city').value = 'Manual coordinates'; byId('city').dataset.locatedAt = '';  });
}
form.elements.method.addEventListener('change', updateMethodNote);
function openField(field) {
  for (let details = field.closest('details'); details; details = details.parentElement.closest('details')) {
    details.open = true;
  }
}
form.addEventListener('invalid', event => openField(event.target), true);
form.addEventListener('submit', event => {
  event.preventDefault();
  applySettings();
});

function todayForPractice() {
  return schedule?.today || dateInZoneFor(new Date(), settings.zone);
}

function refresh() {
  if (schedule && schedule.today === dateInZoneFor(new Date(), settings.zone)) { updateCountdown(); companion.refresh(schedule); return; }
  try {
    showSchedule(requestSchedule(settings));
  } catch (error) {
    const message = byId('prayer-error');
    message.hidden = false;
    message.textContent = error.message;
  }
}

calendar.addEventListener('submit', event => {
  event.preventDefault();
  if (!schedule) return;
  const status = byId('calendar-status');
  const selected = salah.filter(([key]) => calendar.elements[key].checked);
  if (!selected.length) {
    status.textContent = 'Choose at least one prayer.';
    return;
  }
  const calendarFile = makeCalendar([schedule.previous, ...schedule.days], selected,
    settings.city || 'Akhlaq', Number(calendar.elements.lead.value));
  if (!calendarFile.includes('BEGIN:VEVENT')) {
    status.textContent = 'No upcoming times are available to export.';
    return;
  }
  downloadFile('akhlaq-prayers-' + schedule.today + '.ics', calendarFile, 'text/calendar;charset=utf-8');
  status.textContent = 'Calendar downloaded. Open the file in your calendar app to import it.';
});

let openPage;

function navigate() {
  const [requested, target = ''] = location.hash.slice(1).split('/');
  const page = ['quran', 'qibla', 'practice', 'dhikr', 'settings', 'learn', 'essentials'].includes(requested) ? requested : 'home';
  if (openPage !== page) {
    const initial = openPage === undefined;
    if (openPage === 'qibla' && byId('compass').textContent === 'Stop compass') byId('compass').click();
    openPage = page;
    for (const section of document.querySelectorAll('[data-page]')) section.hidden = section.dataset.page !== page;
    for (const link of document.querySelectorAll('[data-route]')) {
      const active = link.dataset.route === (page === 'dhikr' ? 'practice' : page === 'essentials' ? 'learn' : page);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
    if (!initial) {
      const heading = document.querySelector('[data-page="' + page + '"] :is(h1, h2)');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }
  quran.navigate(page, target);
  learning.navigate(page);
  companion.navigate(page);
}

function start() {
  for (const [key, label] of prayers) {
    const offset = document.createElement('label');
    offset.className = 'field';
    const input = document.createElement('input');
    Object.assign(input, { name: 'offset-' + key, type: 'number', min: '-60', max: '60', step: '1' });
    offset.append(label + ' (min)', input);
    byId('offsets').append(offset);
  }
  for (const [key, label] of salah) {
    const choice = document.createElement('label');
    const input = document.createElement('input');
    Object.assign(input, { type: 'checkbox', name: key, checked: true });
    choice.append(input, ' ' + label);
    byId('calendar-prayers').querySelector('.checks').append(choice);
  }
  byId('city').dataset.locatedAt = String(settings.locatedAt || 0);
  fillForm();
  practiceLog.refresh();
  learning.refreshDaily();
  refresh();
  setupInstall(practiceLog.hasUnsavedReflection, quran.isPlaying);
  navigate();
  window.addEventListener('hashchange', navigate);
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith('akhlaq.practice.v1.')) practiceLog.refresh();
  });
  setInterval(refresh, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
}

start();
