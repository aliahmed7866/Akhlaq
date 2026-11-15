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

export function readHeading(event, rotation, declination) {
  const { alpha, beta, gamma, absolute, webkitCompassHeading, webkitCompassAccuracy } = event;
  const native = Number.isFinite(webkitCompassHeading) && webkitCompassHeading >= 0;
  if (!native && (!absolute || ![alpha, beta, gamma].every(Number.isFinite))) return null;
  if (!Number.isFinite(declination)) return { issue: 'correction' };
  if (native) {
    if (!Number.isFinite(beta) || !Number.isFinite(gamma) || Math.abs(beta) > 32 || Math.abs(gamma) > 32) {
      return { issue: 'tilt' };
    }
    if (Number.isFinite(webkitCompassAccuracy) && (webkitCompassAccuracy < 0 || webkitCompassAccuracy > 20)) {
      return { issue: 'calibration' };
    }
    return { heading: wrap(webkitCompassHeading + rotation + declination) };
  }

  // Project the screen's top edge onto the local East/North plane after intrinsic Z-X-Y rotation.
  const pitch = beta * radians;
  const roll = gamma * radians;
  const yaw = alpha * radians;
  const screen = rotation * radians;
  const x = Math.sin(screen);
  const y = Math.cos(screen);
  const u = Math.cos(roll) * x;
  const v = Math.sin(pitch) * Math.sin(roll) * x + Math.cos(pitch) * y;
  if (Math.cos(pitch) * Math.cos(roll) < 0.3 || Math.hypot(u, v) < 0.58) return { issue: 'tilt' };
  const east = Math.cos(yaw) * u - Math.sin(yaw) * v;
  const north = Math.sin(yaw) * u + Math.cos(yaw) * v;
  return { heading: wrap(Math.atan2(east, north) / radians + declination) };
}

const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const degrees = value => Math.round(wrap(value)) % 360 + '°';
const cardinal = value => directions[Math.round(wrap(value) / 22.5) % 16];

export function setupCompass() {
  const native = window.AkhlaqNative;
  const get = id => document.getElementById(id);
  const button = get('compass');
  const note = get('compass-note');
  const dial = get('compass-dial');
  const rose = get('dial-rose');
  const needle = get('needle');
  const headingText = get('phone-heading');
  const turnText = get('compass-turn');
  const staticNote = note.textContent;
  let position;
  let listening = false;
  let promptPending = false;
  let heading = null;
  let previousTime = 0;
  let initialTimer;
  let alignmentTimer;
  let staleTimer;
  let lastEvent;
  let aligned = false;

  function setAligned(value) {
    aligned = value;
    dial.dataset.aligned = String(value);
  }

  function draw() {
    rose.style.transform = 'rotate(' + -(heading ?? 0) + 'deg)';
    rose.style.setProperty('--heading', (heading ?? 0) + 'deg');
    if (Number.isFinite(position?.bearing)) {
      needle.style.transform = 'rotate(' + (position.bearing - (heading ?? 0)) + 'deg)';
    }
    headingText.textContent = heading === null ? '—' : degrees(heading) + ' ' + cardinal(heading);
  }

  function resetHeading() {
    clearTimeout(alignmentTimer);
    alignmentTimer = undefined;
    heading = null;
    previousTime = 0;
    setAligned(false);
    turnText.textContent = '—';
    draw();
  }

  function read(event) {
    const angle = window.screen.orientation?.angle ?? Number(window.orientation ?? 0);
    const measurement = readHeading(event.detail || event, native ? 0 : angle, position.declination);
    if (!measurement) return;
    clearTimeout(staleTimer);
    staleTimer = setTimeout(() => { resetHeading(); note.textContent = 'Compass readings paused. Move the phone gently or restart the compass.'; }, 2200);
    lastEvent = event;
    clearTimeout(initialTimer);
    if (measurement.issue) {
      resetHeading();
      note.textContent = {
        tilt: 'Hold the phone flatter with the screen facing up.',
        calibration: 'Move away from metal or magnets, then trace a figure eight with your phone.',
        correction: 'Use the true-north bearing here. Magnetic correction is unavailable.',
      }[measurement.issue];
      return;
    }
    const now = performance.now();
    const weight = 1 - Math.exp(-Math.max(now - previousTime, 24) / 135);
    heading = smoothHeading(heading, measurement.heading, weight);
    previousTime = now;
    draw();
    const turn = turnAngle(heading, position.bearing);
    const rawTurn = turnAngle(measurement.heading, position.bearing);
    if (Math.abs(turn) <= (aligned ? 7 : 4) && Math.abs(rawTurn) <= 7) {
      if (!aligned && !alignmentTimer) {
        note.textContent = 'Hold steady to confirm alignment.';
        alignmentTimer = setTimeout(() => {
          alignmentTimer = undefined;
          setAligned(true);
          turnText.textContent = 'Aligned';
          note.textContent = 'You’re facing the Qibla.';
        }, 450);
      }
      return;
    }

    clearTimeout(alignmentTimer);
    alignmentTimer = undefined;
    setAligned(false);
    const instruction = Math.abs(turn) <= 4 ? 'Hold steady' : degrees(Math.abs(turn)) + (turn > 0 ? ' right' : ' left');
    turnText.textContent = instruction;
    const message = Math.abs(turn) <= 4 ? 'Hold steady while the heading settles.' : 'Turn ' + instruction + '.';
    if (note.textContent !== message) note.textContent = message;
  }

  function stop(message = staticNote) {
    listening = false;
    if (native) { native.compass(false); window.removeEventListener('akhlaq-heading', read); }
    lastEvent = undefined;
    clearTimeout(initialTimer);
    clearTimeout(staleTimer);
    for (const name of ['deviceorientationabsolute', 'deviceorientation']) window.removeEventListener(name, read);
    resetHeading();
    button.textContent = 'Start live compass';
    note.textContent = message;
  }

  button.addEventListener('click', async () => {
    if (listening) return stop();
    if (promptPending) return;
    if (!Number.isFinite(position?.declination)) return stop('Magnetic correction is unavailable here. Use the true-north bearing.');
    promptPending = true;
    try {
      if (!native && typeof window.DeviceOrientationEvent?.requestPermission === 'function'
          && await window.DeviceOrientationEvent.requestPermission(true) !== 'granted') {
        return stop('Motion access was denied. The true and magnetic bearings still work.');
      }
      if (document.hidden) return;
      listening = true;
      button.textContent = 'Stop compass';
      note.textContent = 'Hold the phone flat, screen up, and away from metal.';
      if (native) { window.addEventListener('akhlaq-heading', read); native.compass(true); }
      else for (const name of ['deviceorientationabsolute', 'deviceorientation']) window.addEventListener(name, read);
      initialTimer = setTimeout(() => stop('No compass reading. Check your browser’s motion permissions or use the magnetic bearing.'), 8500);
    } catch {
      stop('Live heading is unavailable. Use the bearings above.');
    } finally {
      promptPending = false;
    }
  });

  window.screen.orientation?.addEventListener('change', () => {
    if (listening && lastEvent) {
      resetHeading();
      read(lastEvent);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && listening) stop();
  });

  return data => {
    const moved = position?.bearing !== data.bearing || position?.declination !== data.declination;
    position = data;
    if (moved) stop();
    const { bearing, declination, distanceKm } = data;
    const valid = Number.isFinite(bearing);
    needle.hidden = !valid;
    button.disabled = !valid || !Number.isFinite(declination);
    get('bearing').textContent = valid
      ? degrees(bearing) + ' true · ' + cardinal(bearing)
      : 'Qibla bearing unavailable at this location';
    get('magnetic').hidden = !valid || !Number.isFinite(declination);
    get('magnetic').textContent = valid && Number.isFinite(declination)
      ? degrees(bearing - declination) + ' on a magnetic compass' : '';
    get('qibla-distance').textContent = Number.isFinite(distanceKm) && distanceKm >= 1
      ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(distanceKm) + ' km to the Kaaba' : '';
    if (button.disabled && valid) note.textContent = 'Magnetic correction is unavailable here. Use the true-north bearing.';
    draw();
  };
}
