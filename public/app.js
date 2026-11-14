const byId = id => document.getElementById(id);
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
const practice = byId('practice-form');
const settingsStatus = byId('settings-status');
const compassButton = byId('compass');
const compassNote = byId('compass-note');
const staticNote = compassNote.textContent;
const dateFormatters = new Map();
const practiceFields = [...salah.map(([key]) => key), 'quran', 'dhikr', 'kindness'];
const drafts = new Map();
let settings = { ...defaults, ...stored(settingsKey) };
let schedule;
let clock;
let practiceDay;
let trackToday = true;
let listening = false;
let compassTimer;
let orientationTimer;
let heading = null;
let cities = [];

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

async function requestSchedule(selection) {
  const query = new URLSearchParams({
    lat: selection.latitude, lon: selection.longitude, zone: selection.zone, method: selection.method,
    madhab: selection.madhab, highLatitude: selection.highLatitude, offsets: selection.offsets.join(','),
  });
  return fetchJson('/api/prayers?' + query);
}

function showSchedule(data) {
  const previous = schedule?.today;
  schedule = data;
  clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  byId('prayer-error').hidden = true;
  byId('today-label').textContent = dateLabel(schedule.today, true);
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
  stopCompass();
  if (previous !== data.today) {
    if (trackToday || !practiceDay || practiceDay > data.today) showPractice(data.today);
    else byId('later').disabled = false;
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

function wrap(degrees) {
  return (degrees % 360 + 360) % 360;
}

function drawCompass() {
  const bearing = schedule?.bearing;
  const declination = schedule?.declination;
  const valid = Number.isFinite(bearing);
  byId('needle').hidden = !valid;
  compassButton.disabled = !valid;
  byId('bearing').textContent = valid
    ? (Math.round(bearing) % 360) + '° true · ' + ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8]
    : 'Qibla bearing unavailable at this location';
  byId('magnetic').hidden = !valid || !Number.isFinite(declination);
  if (!byId('magnetic').hidden) {
    byId('magnetic').textContent = (Math.round(wrap(bearing - declination)) % 360) + '° on a magnetic compass';
  }
  byId('dial-rose').style.transform = 'rotate(' + -(heading ?? 0) + 'deg)';
  byId('needle').style.transform = 'rotate(' + (bearing - (heading ?? 0)) + 'deg)';
}

function onOrientation(event) {
  if (!listening || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  if (Math.abs(event.beta) > 30 || Math.abs(event.gamma) > 30) {
    heading = null;
    drawCompass();
    compassNote.textContent = 'Hold your phone flat to find the Qibla.';
    return;
  }
  if (!Number.isFinite(schedule?.declination)) {
    stopCompass('Magnetic correction is unavailable here. Use the true-north bearing above.');
    return;
  }
  const magnetic = Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0
    ? event.webkitCompassHeading
    : event.absolute && Number.isFinite(event.alpha) ? -event.alpha : null;
  if (magnetic === null) return;

  clearTimeout(compassTimer);
  clearTimeout(orientationTimer);
  orientationTimer = setTimeout(() => stopCompass('Phone heading stopped updating. Start again or use the bearing above.'), 4000);
  const rotation = screen.orientation?.angle ?? Number(window.orientation ?? 0);
  heading = wrap(magnetic + schedule.declination + rotation);
  const turn = wrap(schedule.bearing - heading + 180) - 180;
  const remaining = Math.round(Math.abs(turn));
  const message = remaining <= 5
    ? 'You’re facing the Qibla.'
    : 'Turn ' + remaining + '° ' + (turn > 0 ? 'right.' : 'left.');
  if (compassNote.textContent !== message) compassNote.textContent = message;
  byId('dial-rose').style.transform = 'rotate(' + -heading + 'deg)';
  byId('needle').style.transform = 'rotate(' + (schedule.bearing - heading) + 'deg)';
}

function stopCompass(message = staticNote) {
  listening = false;
  heading = null;
  clearTimeout(compassTimer);
  clearTimeout(orientationTimer);
  window.removeEventListener('deviceorientationabsolute', onOrientation);
  window.removeEventListener('deviceorientation', onOrientation);
  compassButton.textContent = 'Start live compass';
  compassNote.textContent = message;
  if (schedule) drawCompass();
}

compassButton.addEventListener('click', async () => {
  if (listening) return stopCompass();
  try {
    if (typeof window.DeviceOrientationEvent?.requestPermission === 'function'
        && await window.DeviceOrientationEvent.requestPermission() !== 'granted') {
      return stopCompass('Motion permission was denied. You can still use the bearing above.');
    }
    listening = true;
    compassButton.textContent = 'Stop compass';
    compassNote.textContent = 'Hold your phone flat and away from metal.';
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);
    compassTimer = setTimeout(() => stopCompass('No usable heading received. Check motion permissions or use the bearing above.'), 9000);
  } catch {
    stopCompass('Live heading is unavailable. You can still use the bearing above.');
  }
});

function findLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Browser location unavailable'));
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve(coords), reject,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}

function readSettings() {
  return {
    city: byId('city').value,
    latitude: form.elements.latitude.valueAsNumber,
    longitude: form.elements.longitude.valueAsNumber,
    zone: form.elements.zone.value.trim(), method: form.elements.method.value,
    madhab: form.elements.madhab.value, highLatitude: form.elements.highLatitude.value,
    offsets: prayers.map(([key]) => form.elements['offset-' + key].valueAsNumber || 0),
  };
}

let saving = false;
async function applySettings() {
  if (saving || !form.reportValidity()) return;
  saving = true;
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  settingsStatus.textContent = 'Calculating…';
  const selection = readSettings();
  try {
    const data = await requestSchedule(selection);
    settings = selection;
    const saved = save(settingsKey, settings);
    showSchedule(data);
    settingsStatus.textContent = saved ? 'Settings saved.' : 'Settings applied for this session. Browser storage is unavailable.';
  } catch (error) {
    settingsStatus.textContent = error.message;
  } finally {
    saving = false;
    submit.disabled = false;
  }
}

byId('gps').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  settingsStatus.textContent = 'Getting your location…';
  try {
    const { latitude, longitude } = await findLocation().catch(() => fetchJson('/api/gps', { method: 'POST' }));
    byId('city').value = '';
    form.elements.latitude.value = latitude;
    form.elements.longitude.value = longitude;
    form.elements.zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await applySettings();
  } catch (error) {
    settingsStatus.textContent = error.message + ' You can also choose a city.';
  } finally {
    button.disabled = false;
  }
});

byId('city').addEventListener('change', async event => {
  const city = cities.find(entry => entry.name === event.target.value);
  if (!city) return;
  for (const name of ['latitude', 'longitude', 'zone']) form.elements[name].value = city[name];
  await applySettings();
});
for (const name of ['latitude', 'longitude', 'zone']) {
  form.elements[name].addEventListener('input', () => { byId('city').value = ''; });
}
form.elements.method.addEventListener('change', updateMethodNote);
form.addEventListener('submit', event => {
  event.preventDefault();
  void applySettings();
});

function todayForPractice() {
  return schedule?.today || dateInZoneFor(new Date(), settings.zone);
}

function showPractice(day) {
  practiceDay = day;
  const entry = stored('akhlaq.practice.v1.' + day);
  for (const name of practiceFields) practice.elements[name].checked = entry[name] === true;
  practice.elements.reflection.value = drafts.get(day) ?? entry.reflection ?? '';
  byId('practice-date').textContent = dateLabel(day, true);
  byId('later').disabled = day >= todayForPractice();
  byId('save-status').textContent = drafts.has(day) ? 'Unsaved reflection' : '';
}

function savePractice(includeReflection) {
  const key = 'akhlaq.practice.v1.' + practiceDay;
  const entry = Object.fromEntries(practiceFields.map(name => [name, practice.elements[name].checked]));
  entry.reflection = includeReflection ? practice.elements.reflection.value : stored(key).reflection || '';
  const saved = save(key, entry);
  if (saved && includeReflection) drafts.delete(practiceDay);
  byId('save-status').textContent = saved ? (drafts.has(practiceDay) ? 'Unsaved reflection' : 'Saved on this device')
    : 'Browser storage is unavailable.';
}

practice.elements.reflection.addEventListener('input', event => {
  drafts.set(practiceDay, event.target.value);
  byId('save-status').textContent = 'Unsaved reflection';
});
practice.addEventListener('change', event => {
  if (event.target.type === 'checkbox') savePractice(false);
});
practice.addEventListener('submit', event => {
  event.preventDefault();
  savePractice(true);
});
byId('earlier').addEventListener('click', () => {
  trackToday = false;
  showPractice(shiftDate(practiceDay, -1));
});
byId('later').addEventListener('click', () => {
  const next = shiftDate(practiceDay, 1);
  if (next <= todayForPractice()) {
    trackToday = next === todayForPractice();
    showPractice(next);
  }
});
byId('today').addEventListener('click', () => {
  trackToday = true;
  showPractice(todayForPractice());
});

let refreshing = false;
async function refresh() {
  if (saving || refreshing) return;
  if (schedule && schedule.today === dateInZoneFor(new Date(), settings.zone)) return updateCountdown();
  refreshing = true;
  const selection = settings;
  try {
    const data = await requestSchedule(selection);
    if (selection === settings) showSchedule(data);
  } catch (error) {
    const message = byId('prayer-error');
    message.hidden = false;
    message.textContent = error.message;
  } finally {
    refreshing = false;
  }
}

async function start() {
  for (const [key, label] of prayers) {
    const offset = document.createElement('label');
    offset.className = 'field';
    const input = document.createElement('input');
    Object.assign(input, { name: 'offset-' + key, type: 'number', min: '-60', max: '60', step: '1' });
    offset.append(label + ' (min)', input);
    byId('offsets').append(offset);
  }
  for (const [key, label] of salah) {
    const check = document.createElement('label');
    const input = document.createElement('input');
    Object.assign(input, { type: 'checkbox', name: key });
    check.append(input, ' ' + label);
    byId('prayer-checks').append(check);
  }
  try {
    cities = await fetchJson('/api/cities');
    for (const city of cities) byId('city').add(new Option(city.name, city.name));
  } catch {
    settingsStatus.textContent = 'City shortcuts are temporarily unavailable.';
  }
  fillForm();
  showPractice(todayForPractice());
  await refresh();
  setInterval(refresh, 15000);
}

void start();
