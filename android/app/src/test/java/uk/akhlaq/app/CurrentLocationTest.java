package uk.akhlaq.app;

import android.Manifest;
import android.app.Application;
import android.location.*;
import android.os.*;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadows.ShadowLocationManager;
import java.time.Duration;
import java.util.*;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 35}, manifest = Config.NONE)
@LooperMode(LooperMode.Mode.PAUSED)
public class CurrentLocationTest {
    private Application app;
    private ShadowLocationManager locations;
    private CurrentLocation request;
    private final List<JSONObject> results = new ArrayList<>();
    @Before public void setup() {
        app = RuntimeEnvironment.getApplication();
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION);
        locations = shadowOf(app.getSystemService(LocationManager.class));
        locations.setLocationEnabled(true);
        locations.setProviderEnabled(LocationManager.GPS_PROVIDER, true);
        locations.setProviderEnabled(LocationManager.NETWORK_PROVIDER, true);
        request = new CurrentLocation(app, results::add);
    }
    @After public void cleanup() { request.cancel(); }
    private Location fix(String provider, float accuracy, long ageMs) {
        Location value = new Location(provider);
        value.setLatitude(53.4808); value.setLongitude(-2.2426); value.setAccuracy(accuracy);
        value.setTime(System.currentTimeMillis() - ageMs);
        value.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos() - ageMs * 1000000);
        return value;
    }
    private void deliver(Location value) { locations.simulateLocation(value); shadowOf(Looper.getMainLooper()).idle(); }
    @Test public void gpsCompletesOnceAndIgnoresLateUpdates() throws Exception {
        request.start("gps"); deliver(fix(LocationManager.GPS_PROVIDER, 12, 0));
        assertEquals(1, results.size()); assertEquals(53.4808, results.get(0).getJSONObject("coords").getDouble("latitude"), .00001);
        deliver(fix(LocationManager.NETWORK_PROVIDER, 30, 0));
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(31)); assertEquals(1, results.size());
    }
    @Test public void approximatePermissionWorksWithoutGps() throws Exception {
        shadowOf(app).denyPermissions(Manifest.permission.ACCESS_FINE_LOCATION);
        request.start("coarse"); deliver(fix(LocationManager.NETWORK_PROVIDER, 2000, 0));
        assertTrue(results.isEmpty()); shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2));
        assertEquals(2000, results.get(0).getJSONObject("coords").getDouble("accuracy"), .1);
    }
    @Test public void waitsForMorePreciseFixWhenAvailable() throws Exception {
        request.start("better"); deliver(fix(LocationManager.NETWORK_PROVIDER, 1200, 0));
        deliver(fix(LocationManager.GPS_PROVIDER, 15, 0));
        assertEquals(15, results.get(0).getJSONObject("coords").getDouble("accuracy"), .1);
    }
    @Test public void disabledServiceHasDifferentRecoveryFromDeniedPermission() throws Exception {
        locations.setLocationEnabled(false); request.start("off");
        assertEquals("disabled", results.get(0).getJSONObject("error").getString("code"));
        shadowOf(app).denyPermissions(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION);
        request.start("denied");
        assertEquals("permission", results.get(1).getJSONObject("error").getString("code"));
    }
    @Test public void staleAndBroadFixesDoNotBecomeCurrentLocation() throws Exception {
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(90));
        request.start("stale"); deliver(fix(LocationManager.GPS_PROVIDER, 12, 70000));
        deliver(fix(LocationManager.NETWORK_PROVIDER, 9000, 0));
        assertTrue(results.isEmpty()); shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(31));
        assertEquals("timeout", results.get(0).getJSONObject("error").getString("code"));
    }
    @Test public void cancellationIsCorrelatedAndAllowsRetry() throws Exception {
        request.start("old"); request.cancel("unrelated"); assertTrue(results.isEmpty());
        request.cancel("old"); assertEquals("cancelled", results.get(0).getJSONObject("error").getString("code"));
        request.start("retry"); deliver(fix(LocationManager.GPS_PROVIDER, 10, 0));
        assertEquals("retry", results.get(1).getString("id"));
        assertTrue(results.get(1).has("coords"));
    }
}
