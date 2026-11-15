package uk.akhlaq.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import org.json.*;
import java.util.*;
import java.util.function.Consumer;

/** A bounded foreground request, independent of WebView geolocation and Google Play Services. */
final class CurrentLocation implements LocationListener {
    private final Context context;
    private final LocationManager manager;
    private final Consumer<JSONObject> result;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String requestId;
    private Location best;
    private boolean settleScheduled;
    private final Runnable timeout = () -> { if (best != null) success(best); else fail("timeout", "No location fix yet. Move near a window or outdoors and retry.", "device"); };
    private final Runnable settle = () -> { if (best != null) success(best); };

    CurrentLocation(Context context, Consumer<JSONObject> result) {
        this.context = context; this.result = result; manager = context.getSystemService(LocationManager.class);
    }
    private boolean allowed(String permission) { return context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    void start(String id) {
        cancel(); requestId = id; best = null; settleScheduled = false;
        if (!allowed(Manifest.permission.ACCESS_COARSE_LOCATION) && !allowed(Manifest.permission.ACCESS_FINE_LOCATION)) { fail("permission", "Allow location for Akhlaq, then retry.", "app"); return; }
        if (manager == null) { fail("unavailable", "This device has no location service.", ""); return; }
        List<String> enabled = manager.getProviders(true);
        if ((Build.VERSION.SDK_INT >= 28 && !manager.isLocationEnabled()) || enabled.isEmpty()) { fail("disabled", "Location is switched off on your phone. Turn it on, then retry.", "device"); return; }
        boolean fine = allowed(Manifest.permission.ACCESS_FINE_LOCATION);
        int registered = 0;
        for (String provider : new String[]{"fused", LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER}) {
            if (!enabled.contains(provider) || (provider.equals(LocationManager.GPS_PROVIDER) && !fine)) continue;
            try {
                // At most 30 seconds, removed on completion, cancellation or leaving the foreground.
                manager.requestLocationUpdates(provider, 1000, 0, this, Looper.getMainLooper()); registered++;
            } catch (SecurityException | IllegalArgumentException ignored) { }
        }
        if (registered == 0) { fail("unavailable", fine ? "No usable location provider. Turn on phone location and retry." : "No approximate-location provider is available. You can enable precise location for Akhlaq and retry.", fine ? "device" : "app"); return; }
        handler.postDelayed(timeout, 30000);
    }
    @Override public void onLocationChanged(Location location) {
        if (requestId == null || location == null || !location.hasAccuracy()) return;
        long age = (SystemClock.elapsedRealtimeNanos() - location.getElapsedRealtimeNanos()) / 1000000;
        double lat = location.getLatitude(), lon = location.getLongitude(); float accuracy = location.getAccuracy();
        // Never silently use an old location from a previous city or a very broad fix.
        if (age < 0 || age > 60000 || !Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180
                || !Float.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) return;
        if (best == null || accuracy < best.getAccuracy()) best = new Location(location);
        if (accuracy <= 100) { success(best); return; }
        if (!settleScheduled) {
            settleScheduled = true;
            handler.postDelayed(settle, allowed(Manifest.permission.ACCESS_FINE_LOCATION) ? 8000 : 2000);
        }
    }
    private void success(Location location) {
        if (requestId == null) return;
        try {
            JSONObject coords = new JSONObject().put("latitude", location.getLatitude()).put("longitude", location.getLongitude())
                .put("accuracy", location.getAccuracy());
            JSONObject value = new JSONObject().put("id", requestId).put("coords", coords);
            clear(); result.accept(value);
        } catch (JSONException ignored) { fail("unavailable", "The device returned an invalid location. Retry.", ""); }
    }
    private void fail(String code, String message, String action) {
        if (requestId == null) return;
        try {
            JSONObject value = new JSONObject().put("id", requestId).put("error", new JSONObject().put("code", code).put("message", message).put("action", action));
            clear(); result.accept(value);
        } catch (JSONException ignored) { clear(); }
    }
    void cancel(String id) { if (Objects.equals(id, requestId)) cancel(); }
    void cancel() { if (requestId != null) fail("cancelled", "Location request cancelled. Tap Use current location to try again.", ""); else clear(); }
    private void clear() {
        requestId = null; best = null; settleScheduled = false; handler.removeCallbacksAndMessages(null);
        if (manager != null) try { manager.removeUpdates(this); } catch (SecurityException ignored) { }
    }
    @Override public void onProviderDisabled(String provider) {
        if (Build.VERSION.SDK_INT >= 28 && !manager.isLocationEnabled()) fail("disabled", "Location is switched off on your phone. Turn it on, then retry.", "device");
    }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
}
