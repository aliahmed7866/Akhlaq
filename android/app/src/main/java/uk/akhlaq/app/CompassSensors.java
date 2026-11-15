package uk.akhlaq.app;

import android.app.Activity;
import android.hardware.*;
import android.os.SystemClock;
import android.view.Surface;
import org.json.*;
import java.util.function.Consumer;

/** North-referenced sensors only. Quality categories are never converted to invented degrees. */
final class CompassSensors implements SensorEventListener {
    private final Activity activity;
    private final SensorManager manager;
    private final Consumer<JSONObject> emit;
    private final float[] gravity = new float[3], magnetic = new float[3];
    private boolean running, fallback, gravityReady;
    private long magneticAt, gravityAt, lastHeading;
    private int magneticAccuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private String source;

    CompassSensors(Activity activity, Consumer<JSONObject> emit) {
        this.activity = activity; this.emit = emit;
        manager = activity.getSystemService(SensorManager.class);
    }
    void stop() { running = false; manager.unregisterListener(this); }
    private void issue(String value) {
        try { emit.accept(new JSONObject().put("issue", value)); } catch (JSONException ignored) { }
    }
    void start() {
        stop(); magneticAt = gravityAt = lastHeading = 0; gravityReady = false;
        magneticAccuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
        Sensor vector = manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (vector == null) vector = manager.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
        Sensor magnet = manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        fallback = vector == null;
        source = fallback ? "Accelerometer + magnetometer" : vector.getType() == Sensor.TYPE_ROTATION_VECTOR ? "Fused rotation sensor" : "Geomagnetic rotation sensor";
        running = true;
        if (!fallback) {
            if (manager.registerListener(this, vector, SensorManager.SENSOR_DELAY_GAME)) {
                if (magnet != null) manager.registerListener(this, magnet, SensorManager.SENSOR_DELAY_UI);
                return;
            }
            fallback = true; source = "Accelerometer + magnetometer";
        }
        Sensor accelerometer = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        if (magnet == null || accelerometer == null
                || !manager.registerListener(this, magnet, SensorManager.SENSOR_DELAY_GAME)
                || !manager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME)) {
            stop(); issue("unsupported");
        }
    }
    @Override public void onSensorChanged(SensorEvent event) {
        if (!running) return;
        long now = SystemClock.elapsedRealtime();
        if ((SystemClock.elapsedRealtimeNanos() - event.timestamp) / 1000000 > 750) { issue("stale"); return; }
        int type = event.sensor.getType();
        if (type == Sensor.TYPE_MAGNETIC_FIELD) {
            System.arraycopy(event.values, 0, magnetic, 0, 3);
            magneticAt = now; magneticAccuracy = event.accuracy;
            if (!fallback) return;
        } else if (type == Sensor.TYPE_ACCELEROMETER) {
            for (int i = 0; i < 3; i++) gravity[i] = gravityReady ? gravity[i] + .18f * (event.values[i] - gravity[i]) : event.values[i];
            gravityAt = now; gravityReady = true;
        }
        if (now - lastHeading < 70) return;
        float[] matrix = new float[9], adjusted = new float[9], orientation = new float[3];
        double headingAccuracy = Double.NaN;
        int status;
        if (fallback) {
            if (!gravityReady || magneticAt == 0 || now - magneticAt > 750 || now - gravityAt > 750) { issue("stale"); return; }
            if (!SensorManager.getRotationMatrix(matrix, null, gravity, magnetic)) { issue("calibration"); return; }
            status = magneticAccuracy;
        } else {
            SensorManager.getRotationMatrixFromVector(matrix, event.values);
            status = event.accuracy;
            if (event.values.length > 4 && Float.isFinite(event.values[4]) && event.values[4] >= 0) headingAccuracy = Math.toDegrees(event.values[4]);
        }
        int rotation = activity.getWindowManager().getDefaultDisplay().getRotation();
        int x = SensorManager.AXIS_X, y = SensorManager.AXIS_Y;
        if (rotation == Surface.ROTATION_90) { x = SensorManager.AXIS_Y; y = SensorManager.AXIS_MINUS_X; }
        else if (rotation == Surface.ROTATION_180) { x = SensorManager.AXIS_MINUS_X; y = SensorManager.AXIS_MINUS_Y; }
        else if (rotation == Surface.ROTATION_270) { x = SensorManager.AXIS_MINUS_Y; y = SensorManager.AXIS_X; }
        if (!SensorManager.remapCoordinateSystem(matrix, x, y, adjusted)) return;
        SensorManager.getOrientation(adjusted, orientation); lastHeading = now;
        try {
            JSONObject value = new JSONObject().put("magneticHeading", (Math.toDegrees(orientation[0]) + 360) % 360)
                .put("beta", Math.toDegrees(orientation[1])).put("gamma", Math.toDegrees(orientation[2]))
                .put("accuracyStatus", status).put("headingAccuracy", Double.isFinite(headingAccuracy) ? headingAccuracy : JSONObject.NULL)
                .put("source", source).put("screenRotation", rotation);
            if (magneticAt != 0 && now - magneticAt <= 750) {
                double strength = Math.sqrt(magnetic[0] * magnetic[0] + magnetic[1] * magnetic[1] + magnetic[2] * magnetic[2]);
                value.put("magneticStrength", strength);
            }
            emit.accept(value);
        } catch (JSONException ignored) { }
    }
    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) magneticAccuracy = accuracy;
    }
}
