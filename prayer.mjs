import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Qibla } from 'adhan';
import geomagnetism from 'geomagnetism';

export const cities = [
  { name: 'Manchester', latitude: 53.4808, longitude: -2.2426, zone: 'Europe/London' },
  { name: 'Birmingham', latitude: 52.4862, longitude: -1.8904, zone: 'Europe/London' },
  { name: 'Liverpool', latitude: 53.4084, longitude: -2.9916, zone: 'Europe/London' },
  { name: 'Luton', latitude: 51.8787, longitude: -0.4200, zone: 'Europe/London' },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, zone: 'Europe/London' },
  { name: 'Glasgow', latitude: 55.8642, longitude: -4.2518, zone: 'Europe/London' },
  { name: 'Belfast', latitude: 54.5973, longitude: -5.9301, zone: 'Europe/London' },
];

const methods = {
  MoonsightingCommittee: CalculationMethod.MoonsightingCommittee,
  MuslimWorldLeague: CalculationMethod.MuslimWorldLeague,
  Karachi: CalculationMethod.Karachi,
  Egyptian: CalculationMethod.Egyptian,
  NorthAmerica: CalculationMethod.NorthAmerica,
  UmmAlQura: CalculationMethod.UmmAlQura,
};
const highLatitudes = {
  default: null,
  twilight: HighLatitudeRule.TwilightAngle,
  seventh: HighLatitudeRule.SeventhOfTheNight,
  middle: HighLatitudeRule.MiddleOfTheNight,
};
const prayerNames = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

export function dateInZone(date, zone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return [fields.year, fields.month, fields.day].join('-');
}

function toCivilDate(value) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Enter a valid date.');
  const noon = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(+noon) || noon.toISOString().slice(0, 10) !== value) {
    throw new RangeError('Enter a valid date.');
  }
  return noon;
}

export function shiftDate(value, days) {
  const date = toCivilDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculate(query, now = new Date()) {
  const coordinate = (name, limit) => {
    const raw = query.get(name)?.trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || Math.abs(value) > limit) {
      throw new RangeError('Enter valid latitude and longitude.');
    }
    return value;
  };
  const latitude = coordinate('lat', 90);
  const longitude = coordinate('lon', 180);
  const zone = query.get('zone') || 'Europe/London';
  let today;
  try {
    today = dateInZone(now, zone);
  } catch {
    throw new RangeError('Enter a valid time zone, for example Europe/London.');
  }
  const date = query.get('date') || today;
  const method = query.get('method') || 'MoonsightingCommittee';
  const madhab = query.get('madhab') || 'hanafi';
  const highLatitude = query.get('highLatitude') || 'default';
  const offsetText = query.get('offsets');
  const offsets = offsetText ? offsetText.split(',').map(Number) : Array(6).fill(0);

  if (!Object.hasOwn(methods, method) || !['hanafi', 'standard'].includes(madhab)
      || !Object.hasOwn(highLatitudes, highLatitude)) {
    throw new RangeError('Choose valid calculation settings.');
  }
  if (offsets.length !== 6 || offsets.some(value => !Number.isInteger(value) || Math.abs(value) > 60)) {
    throw new RangeError('Prayer adjustments must be whole minutes between −60 and +60.');
  }

  const coordinates = new Coordinates(latitude, longitude);
  const parameters = methods[method]();
  parameters.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  parameters.highLatitudeRule = highLatitudes[highLatitude] || HighLatitudeRule.recommended(new Coordinates(Math.abs(latitude), longitude));
  prayerNames.forEach((name, index) => { parameters.adjustments[name] = offsets[index]; });

  function timesFor(day) {
    const calculateFor = value => {
      const civil = toCivilDate(value);
      const instant = new Date(civil.getUTCFullYear(), civil.getUTCMonth(), civil.getUTCDate(), 12);
      return new PrayerTimes(coordinates, instant, parameters);
    };
    let times = calculateFor(day);
    // Political time zones can put solar noon on a different civil date, notably near the date line.
    if (Number.isFinite(+times.dhuhr)) {
      const localNoonDate = dateInZone(times.dhuhr, zone);
      if (localNoonDate !== day) times = calculateFor(shiftDate(day, localNoonDate > day ? -1 : 1));
    }
    return {
      date: day,
      times: Object.fromEntries(prayerNames.map(name => [
        name, Number.isFinite(+times[name]) ? times[name].toISOString() : null,
      ])),
    };
  }
  const days = Array.from({ length: 7 }, (_, index) => timesFor(shiftDate(date, index)));
  const previous = timesFor(shiftDate(date, -1));

  let declination = null, magneticStrength = null;
  try {
    const magnetic = geomagnetism.model(now).point([latitude, longitude]);
    if (Number.isFinite(magnetic.f)) magneticStrength = magnetic.f / 1000;
    if (Number.isFinite(magnetic.decl) && magnetic.h >= 6000) declination = magnetic.decl;
  } catch (error) {
    if (!/date/i.test(error.message)) throw error;
  }
  const radians = Math.PI / 180;
  const kaabaLatitude = 21.4225241;
  const kaabaLongitude = 39.8261818;
  const haversine = Math.sin((latitude - kaabaLatitude) * radians / 2) ** 2
    + Math.cos(latitude * radians) * Math.cos(kaabaLatitude * radians)
    * Math.sin((longitude - kaabaLongitude) * radians / 2) ** 2;
  const arc = 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
  const distanceKm = 6371 * arc;
  const bearing = Math.abs(latitude) === 90 || distanceKm < 0.015 || Math.PI - arc < 0.000002
    ? null : Qibla(coordinates);
  return { days, previous, today, zone, bearing, declination, distanceKm, magneticStrength };
}
