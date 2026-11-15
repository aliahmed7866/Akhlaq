const radians = Math.PI / 180;

export function wrap(degrees) {
  return (degrees % 360 + 360) % 360;
}

export function turnAngle(from, to) {
  return wrap(to - from + 180) - 180;
}

export function smoothHeading(previous, next, weight) {
  return previous === null ? next : previous + turnAngle(previous, next) * weight;
}

// Sensor error estimates and stability serve different purposes: a steady wrong heading is possible.
export function createHeadingTracker() {
  let samples = [];
  return {
    reset() { samples = []; },
    update(heading, now) {
      if (!Number.isFinite(heading) || !Number.isFinite(now)) { samples = []; return false; }
      if (samples.length && (now <= samples.at(-1).at || now - samples.at(-1).at > 400)) samples = [];
      samples.push({ heading, at: now });
      samples = samples.filter(s => now - s.at <= 1200);
      if (samples.length < 8 || now - samples[0].at < 800) return false;
      const offsets = samples.map(s => turnAngle(samples[0].heading, s.heading));
      return Math.max(...offsets) - Math.min(...offsets) <= 6;
    },
  };
}

export function readHeading(event, rotation, declination, expectedStrength = null) {
  if (event.issue) return { issue: event.issue };
  const { alpha, beta, gamma, absolute, webkitCompassHeading, webkitCompassAccuracy } = event;
  const android = Number.isFinite(event.magneticHeading);
  const apple = Number.isFinite(webkitCompassHeading) && webkitCompassHeading >= 0;
  if (!android && !apple && (!absolute || ![alpha, beta, gamma].every(Number.isFinite))) return null;
  if (!Number.isFinite(declination)) return { issue: 'correction' };
  if (android && (!Number.isFinite(event.accuracyStatus) || event.accuracyStatus < 2)) return { issue: 'calibration' };
  const strength = event.magneticStrength;
  if (Number.isFinite(strength) && (strength < 10 || strength > 100 || (Number.isFinite(expectedStrength) && Math.abs(strength - expectedStrength) > Math.max(15, expectedStrength * .35)))) return { issue: 'interference' };
  const accuracy = android ? event.headingAccuracy : apple ? webkitCompassAccuracy : null;
  if (Number.isFinite(accuracy) && (accuracy < 0 || accuracy > 20)) return { issue: 'calibration' };
  if (!Number.isFinite(beta) || !Number.isFinite(gamma) || Math.cos(beta * radians) * Math.cos(gamma * radians) < Math.cos(35 * radians)) return { issue: 'tilt' };
  if (android || apple) return { heading: wrap((android ? event.magneticHeading : webkitCompassHeading + rotation) + declination), accuracy: Number.isFinite(accuracy) ? accuracy : null };

  // Project the screen's top edge onto East/North after intrinsic Z-X-Y rotation.
  const pitch = beta * radians, roll = gamma * radians, yaw = alpha * radians, screen = rotation * radians;
  const x = Math.sin(screen), y = Math.cos(screen);
  const u = Math.cos(roll) * x;
  const v = Math.sin(pitch) * Math.sin(roll) * x + Math.cos(pitch) * y;
  if (Math.hypot(u, v) < .58) return { issue: 'tilt' };
  const east = Math.cos(yaw) * u - Math.sin(yaw) * v;
  const north = Math.sin(yaw) * u + Math.cos(yaw) * v;
  return { heading: wrap(Math.atan2(east, north) / radians + declination), accuracy: null };
}

const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const degrees = value => Math.round(wrap(value)) % 360 + '°';
const cardinal = value => directions[Math.round(wrap(value) / 22.5) % 16];

export function setupCompass() {
  const native = window.AkhlaqNative;
  const get = id => document.getElementById(id);
  const button = get('compass'), note = get('compass-note'), dial = get('compass-dial');
  const rose = get('dial-rose'), needle = get('needle'), quality = get('compass-quality');
  const tracker = createHeadingTracker();
  let position, listening = false, promptPending = false, heading = null, previousTime = 0;
  let initialTimer, staleTimer, absoluteReceived = false, rotation;
  function draw() {
    rose.style.transform = 'rotate(' + -(heading ?? 0) + 'deg)';
    rose.style.setProperty('--heading', (heading ?? 0) + 'deg');
    needle.hidden = heading === null || !Number.isFinite(position?.bearing);
    if (!needle.hidden) needle.style.transform = 'rotate(' + (position.bearing - heading) + 'deg)';
    get('phone-heading').textContent = heading === null ? '—' : degrees(heading) + ' ' + cardinal(heading);
    dial.dataset.live = String(heading !== null);
  }
  function resetHeading() {
    heading = null; previousTime = 0; tracker.reset(); dial.dataset.aligned = 'false';
    get('compass-turn').textContent = '—'; draw();
  }
  const issues = {
    tilt: 'Lay the phone flatter, with its screen facing up.',
    calibration: 'Move away from metal or magnets. Slowly move the phone in a figure eight, then hold it flat.',
    interference: 'Possible magnetic interference. Remove magnetic cases and move away from metal, then try again.',
    correction: 'True-north correction is unavailable. Use the bearing in Direction details.',
    unsupported: 'This device has no usable north-referenced compass sensor. Use Direction details with a separate compass.',
    stale: 'Waiting for fresh sensor readings. Hold the phone flat or tap Recheck.',
  };
  function read(event) {
    if (!listening || !position) return;
    if (event.type === 'deviceorientationabsolute') absoluteReceived = true;
    if (event.type === 'deviceorientation' && absoluteReceived) return;
    const detail = event.detail || event;
    const angle = window.screen.orientation?.angle ?? Number(window.orientation ?? 0);
    if (rotation !== detail.screenRotation) { resetHeading(); rotation = detail.screenRotation; }
    const measurement = readHeading(detail, native ? 0 : angle, position.declination, position.magneticStrength);
    if (!measurement) return;
    clearTimeout(initialTimer); clearTimeout(staleTimer);
    if (measurement.issue === 'unsupported') return stop(issues.unsupported);
    staleTimer = setTimeout(() => { resetHeading(); quality.textContent = 'Readings paused'; note.textContent = issues.stale; }, 1500);
    if (measurement.issue) {
      resetHeading(); quality.textContent = measurement.issue === 'tilt' ? 'Hold flat' : 'Check sensor';
      note.textContent = issues[measurement.issue] || issues.calibration; return;
    }
    const now = performance.now();
    const stable = tracker.update(measurement.heading, now);
    const weight = 1 - Math.exp(-Math.max(now - previousTime, 20) / 160);
    heading = smoothHeading(heading, measurement.heading, weight); previousTime = now; draw();
    const turn = turnAngle(heading, position.bearing), rawTurn = turnAngle(measurement.heading, position.bearing);
    const locationError = position.locationAccuracy > 0 ? Math.atan2(position.locationAccuracy, position.distanceKm * 1000) / radians : 0;
    const known = Number.isFinite(measurement.accuracy);
    const reliable = known && measurement.accuracy <= 10 && locationError <= 3;
    quality.textContent = known ? 'Sensor estimate ±' + Math.ceil(measurement.accuracy) + '°' : 'Approximate · accuracy not reported';
    if (locationError > 3) quality.textContent = 'Location too approximate · refresh GPS';
    get('compass-source').textContent = detail.source || 'Browser compass';
    const aligned = stable && reliable && Math.abs(turn) <= 4 && Math.abs(rawTurn) <= 4;
    dial.dataset.aligned = String(aligned);
    get('compass-turn').textContent = aligned ? 'Facing Qibla' : Math.abs(turn) <= 4 ? 'Hold steady' : Math.round(Math.abs(turn)) + '° ' + (turn > 0 ? 'right' : 'left');
    note.textContent = aligned ? 'Keep the top of your phone pointing this way. The sensor estimate is not a guarantee.'
      : Math.abs(turn) <= 4 ? (reliable ? 'Hold still for a moment to check direction.' : 'Approximate direction. Check against a trusted compass or local prayer space.')
      : 'Turn slowly ' + (turn > 0 ? 'right' : 'left') + ' until the arrow points to the top of your phone.';
  }
  function stop(message = 'Start the compass, then point the top of your phone towards the arrow.') {
    listening = false; clearTimeout(initialTimer); clearTimeout(staleTimer);
    if (native) { native.compass(false); window.removeEventListener('akhlaq-heading', read); }
    for (const name of ['deviceorientationabsolute', 'deviceorientation']) window.removeEventListener(name, read);
    resetHeading(); button.textContent = 'Start compass'; button.setAttribute('aria-pressed', 'false');
    get('compass-recheck').hidden = true; quality.textContent = 'Compass off'; note.textContent = message;
  }
  async function start() {
    if (promptPending || !position?.locationReady) return;
    if (!Number.isFinite(position?.declination)) return stop(issues.correction);
    promptPending = true;
    try {
      if (!native && typeof window.DeviceOrientationEvent?.requestPermission === 'function' && await window.DeviceOrientationEvent.requestPermission(true) !== 'granted') return stop('Motion access was denied. Use Direction details with a separate compass.');
      if (document.hidden || get('qibla').hidden) return;
      listening = true; absoluteReceived = false; rotation = undefined;
      button.textContent = 'Stop compass'; button.setAttribute('aria-pressed', 'true'); get('compass-recheck').hidden = false;
      quality.textContent = 'Checking sensor…'; note.textContent = 'Hold flat, screen up, away from magnets and metal.';
      initialTimer = setTimeout(() => stop('No compass reading. Check motion permissions or use Direction details.'), 8500);
      if (native) { window.addEventListener('akhlaq-heading', read); native.compass(true); }
      else for (const name of ['deviceorientationabsolute', 'deviceorientation']) window.addEventListener(name, read);
    } catch { stop('Compass unavailable. Use Direction details with a separate compass.'); }
    finally { promptPending = false; }
  }
  button.addEventListener('click', () => listening ? stop() : start());
  get('compass-recheck').addEventListener('click', () => { stop(); start(); });
  window.screen.orientation?.addEventListener('change', () => { if (listening) resetHeading(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && listening) stop(); });
  return data => {
    const changed = position?.bearing !== data.bearing || position?.declination !== data.declination || position?.locationReady !== data.locationReady || position?.locatedAt !== data.locatedAt;
    position = data; if (changed) stop();
    const { bearing, declination, distanceKm } = data, valid = Number.isFinite(bearing);
    button.disabled = !valid || !Number.isFinite(declination) || !data.locationReady;
    get('qibla-location').textContent = !data.locationReady ? 'Use your location to find your Qibla.' : data.locatedAt ? 'Using your saved location · refresh after travelling.' : 'Using your saved coordinates.';
    get('qibla-gps').classList.toggle('primary', !data.locationReady);
    get('qibla-gps').textContent = data.locationReady ? 'Refresh location' : 'Use current location';
    get('bearing').textContent = valid ? degrees(bearing) + ' true north · ' + cardinal(bearing) : 'Bearing unavailable at this location';
    get('magnetic').hidden = !valid || !Number.isFinite(declination);
    get('magnetic').textContent = valid && Number.isFinite(declination) ? degrees(bearing - declination) + ' on a magnetic compass' : '';
    get('qibla-distance').textContent = Number.isFinite(distanceKm) && distanceKm >= 1 ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(distanceKm) + ' km to the Kaaba' : '';
    if (!data.locationReady) note.textContent = 'Location first, then start the compass. No background location tracking.';
    draw();
  };
}
