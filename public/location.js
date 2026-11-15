export class LocationError extends Error {
  constructor(code, message, action = '') { super(message); this.code = code; this.action = action; }
}
export function validCoordinates(value) {
  const {latitude, longitude, accuracy} = value || {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new LocationError('invalid', 'The device returned an invalid location. Please retry.');
  return {latitude, longitude, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : 0};
}
let sequence = 0;
export function findCurrentLocation({native, geolocation, events, signal, fetchGps, watchdogMs = 120000}) {
  if (native) {
    if (typeof native.requestLocation !== 'function') return Promise.reject(new LocationError('update', 'Update the Android app to use the repaired location feature.'));
    return new Promise((resolve, reject) => {
      const id = 'location-' + Date.now() + '-' + (++sequence);
      let timer, finished = false;
      const finish = (error, coords) => {
        if (finished) return; finished = true;
        clearTimeout(timer); events.removeEventListener('akhlaq-location', receive); signal?.removeEventListener('abort', cancel);
        if (error) { try { native.cancelLocation?.(id); } catch { /* already stopped */ } reject(error); }
        else resolve(coords);
      };
      const receive = event => {
        const value = event.detail;
        if (value?.id !== id) return;
        if (value.error) return finish(new LocationError(value.error.code, value.error.message, value.error.action));
        try { finish(null, validCoordinates(value.coords)); } catch (error) { finish(error); }
      };
      const cancel = () => finish(new LocationError('cancelled', 'Location request cancelled.'));
      events.addEventListener('akhlaq-location', receive); signal?.addEventListener('abort', cancel, {once:true});
      if (signal?.aborted) return cancel();
      timer = setTimeout(() => finish(new LocationError('timeout', 'Location did not respond. Check phone location and retry.', 'device')), watchdogMs);
      try { native.requestLocation(id); } catch { finish(new LocationError('unavailable', 'Android location could not start. Please retry.', 'device')); }
    });
  }
  return browserLocation({geolocation, signal, fetchGps});
}
async function browserLocation({geolocation, signal, fetchGps}) {
  const get = highAccuracy => new Promise((resolve, reject) => {
    if (!geolocation) return reject(new LocationError('unavailable', 'Browser location is unavailable.'));
    const abort = () => done(new LocationError('cancelled', 'Location request cancelled.'));
    let finished = false;
    const done = (error, coords) => { if (finished) return; finished = true; signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(coords); };
    signal?.addEventListener('abort', abort, {once:true}); if (signal?.aborted) return abort();
    geolocation.getCurrentPosition(({coords}) => { try { done(null, validCoordinates(coords)); } catch (error) { done(error); } }, error => {
      done(new LocationError(error.code === 1 ? 'permission' : error.code === 3 ? 'timeout' : 'unavailable', error.code === 1 ? 'Location permission is blocked. Allow location for this site in your browser, then retry.' : 'No browser location fix yet.'));
    }, {enableHighAccuracy:highAccuracy, timeout:15000, maximumAge:highAccuracy ? 0 : 30000});
  });
  try { return await get(true); } catch (error) {
    if (['permission','cancelled'].includes(error.code)) throw error;
  }
  try { return await get(false); } catch (error) {
    if (['permission','cancelled'].includes(error.code)) throw error;
  }
  if (signal?.aborted) throw new LocationError('cancelled', 'Location request cancelled.');
  if (fetchGps) return validCoordinates(await fetchGps(signal));
  throw new LocationError('unavailable', 'No location fix. Enable phone location, move near a window and retry.');
}
