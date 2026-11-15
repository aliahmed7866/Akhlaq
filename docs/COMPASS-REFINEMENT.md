# Compass and daily UI refinement — 2.3.0

Reviewed 15 November 2026. Changes are on `android-standalone`.

## Findings and changes

The Android bridge previously mapped sensor quality categories to invented angular errors (5, 15 or 30 degrees). It now passes the actual rotation-vector heading-error estimate, converts radians to degrees, and preserves unknown estimates as unknown. Poor calibration blocks the live direction; an unknown angular estimate allows an explicitly approximate direction without the green confirmation state.

North-referenced sensor selection prefers the fused rotation vector, then geomagnetic rotation, then an accelerometer/magnetometer fallback. It never uses the game rotation vector, which does not track north. Display rotation is remapped before the heading is sent. New sessions reset sensor state; leaving Qibla or backgrounding the activity unregisters sensors.

The existing local World Magnetic Model true-north correction is retained. Field strength is also compared with the model as a conservative interference check: values outside 10–100 microtesla, or differing by more than the greater of 15 microtesla and 35%, hide the live arrow. This is a heuristic, not a magnetic-survey instrument; distorted fields can have plausible magnitudes.

Confirmation requires at least eight fresh readings spanning 800 ms, no gap above 400 ms, a heading spread no greater than 6 degrees, reported angular error no greater than 10 degrees, and both raw and smoothed direction within 4 degrees of the Qibla bearing. The green state says “Facing Qibla”, with the device error estimate visible. No timer can confirm direction without new sensor readings. Readings stop displaying after 1.5 seconds without updates. Tilt, unreliable calibration and interference immediately clear confirmation. Unknown sensor error never becomes an invented degree value.

Example Manchester coordinates cannot enable the live compass. Users first use location access or explicitly save manual coordinates. The reported GPS accuracy is stored locally; when its approximate angular effect at the distance to the Kaaba exceeds 3 degrees, confirmation is withheld and the app asks for a location refresh. This check is a usability safeguard, not a guaranteed error bound. Location age is not proof that a user has or has not travelled.

## Simpler interactions

- Today puts all prayer times above the shortcut collection. Each prayer tile is a single reversible log control; sunrise remains non-interactive.
- Prayer alerts and adhan have a direct link that opens the correct settings panel.
- Quran, dhikr, duas and calendar use a compact labelled shortcut grid.
- Qibla has location access, a larger dial, simple left/right instructions, a sensor-quality label and a Recheck action. Technical bearings and calibration guidance are expandable.
- Missing sensors, denied location, poor sensor quality and stale readings have explicit recovery messages. The dial never shows a live arrow while the compass is off.

## Evidence

- [Android SensorEvent reference](https://developer.android.com/reference/android/hardware/SensorEvent): rotation-vector `values[4]` is estimated heading accuracy in radians; unavailable data must not be replaced with assumed accuracy.
- [Android position-sensor guidance](https://developer.android.com/develop/sensors-and-location/sensors/sensors_position): magnetic north, sensor alternatives, orientation matrices and display coordinate remapping; the game rotation vector is unsuitable for a north reference.
- [SensorManager reference](https://developer.android.com/reference/android/hardware/SensorManager): sensor registration and coordinate transforms.

## Validation and limits

Node tests cover true/magnetic correction, screen-top projection, angular wraparound, real/unknown quality data, interference rejection, tilt, stale sample windows and jitter. Browser tests cover location setup, steady-direction confirmation, clearing the arrow after interference or stale data, unknown-error behavior, restart, prayer-tile logging, the reminder shortcut and 78 route/width/text-size combinations. Existing paired Quran playback tests are retained. Android workflows run native compilation, unit tests and lint for both APK and AAB.

These automated checks do not measure physical compass accuracy. Before production, test portrait and landscape, clockwise/counterclockwise turns, near-metal conditions, magnetic cases, sensor absence, permission denial, travel, calibration recovery and several Android manufacturers against a trusted reference outdoors. A phone cannot guarantee precise alignment indoors. No percentage accuracy improvement or scholarly certification is claimed.
