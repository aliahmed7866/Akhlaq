package uk.akhlaq.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.ActivityManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.hardware.*;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import androidx.media3.common.*;
import androidx.media3.session.*;
import androidx.media3.exoplayer.offline.*;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private WebView web;
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private QuranQueue catalog;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile String state = "{\"ready\":false}";
    private volatile String downloadState = "{}";
    private String failure = "";
    private boolean visible;
    private JSONObject pendingCommand;
    private long lastDownloads;
    private long lastQiblaBuzz = -4000;
    private CompassSensors compassSensors;
    private CurrentLocation currentLocation;
    private String pendingLocation;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] exportBytes;
    private String exportName;
    private final Runnable tick = new Runnable() {
        public void run() {
            if (!visible) return;
            publish();
            handler.postDelayed(this, 500);
        }
    };
    static boolean local(Uri uri) { return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443); }
    private void exportResult(String name, String status) {
        runOnUiThread(() -> {
            if (web == null || isDestroyed()) return;
            try { web.evaluateJavascript("window.dispatchEvent(new CustomEvent('akhlaq-export',{detail:" + new JSONObject().put("name", name).put("status", status) + "}))", null); }
            catch (JSONException ignored) { }
        });
    }
    private void sendLocation(JSONObject value) {
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('akhlaq-location',{detail:" + value + "}))", null);
    }
    private void locationError(String id, String code, String message, String action) {
        try { sendLocation(new JSONObject().put("id", id).put("error", new JSONObject().put("code", code).put("message", message).put("action", action))); } catch (JSONException ignored) { }
    }
    private void startPendingLocation() {
        if (!visible || pendingLocation == null) return;
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        String id = pendingLocation; pendingLocation = null; currentLocation.start(id);
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        try {
            catalog = new QuranQueue(AssetText.read(this, "quran.json"));
        } catch (Exception error) { throw new IllegalStateException("Bundled Quran unavailable", error); }
        compassSensors = new CompassSensors(this, value -> { if (visible && web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('akhlaq-heading',{detail:" + value + "}))", null); });
        currentLocation = new CurrentLocation(this, this::sendLocation);
        FrameLayout frame = new FrameLayout(this);
        web = new WebView(this);
        frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(frame);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        }
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // User-selected backup files through Android's picker.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder().addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.addJavascriptInterface(new Bridge(), "AkhlaqNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // A renderer killed under memory pressure must not crash the whole app.
                frame.removeView(view);
                if (web == view) web = null;
                view.destroy();
                currentLocation.cancel(); compassSensors.stop();
                if (!isFinishing() && !isDestroyed()) new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Reopen Akhlaq?")
                    .setMessage("The app view closed. Your saved records are still on this device. Reopen the view to continue.")
                    .setPositiveButton("Reopen", (dialog, which) -> recreate())
                    .setNegativeButton("Close", (dialog, which) -> finish()).setCancelable(false).show();
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!local(request.getUrl())) return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Map.of(), new ByteArrayInputStream(new byte[0]));
                Uri uri = request.getUrl().getPath().equals("/") ? Uri.parse(ORIGIN + "/index.html") : request.getUrl();
                WebResourceResponse response = assets.shouldInterceptRequest(uri);
                if (response == null) return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", Map.of(), new ByteArrayInputStream(new byte[0]));
                response.setResponseHeaders(Map.of("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'", "X-Content-Type-Options", "nosniff"));
                return response;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (local(request.getUrl())) return false;
                if (request.isForMainFrame() && List.of("https", "http").contains(request.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!origin.equals(ORIGIN)) { callback.invoke(origin, false, false); return; }
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) { callback.invoke(origin, true, false); return; }
                if (geoCallback != null) geoCallback.invoke(geoOrigin, false, false);
                geoCallback = callback; geoOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 10);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json"), 11); }
                catch (Exception error) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        AudioStore.downloads(this);
        controllerFuture = new MediaController.Builder(this, new SessionToken(this, new ComponentName(this, PlaybackService.class))).buildAsync();
        controllerFuture.addListener(() -> {
            if (isDestroyed()) return;
            try {
                controller = controllerFuture.get();
                controller.addListener(new Player.Listener() { @Override public void onEvents(Player player, Player.Events events) { publish(); } });
                if (pendingCommand != null) { JSONObject command = pendingCommand; pendingCommand = null; execute(command); }
                publish();
            } catch (Exception error) { failure = "Could not connect to Android audio. Reopen Akhlaq."; publish(); }
        }, this::runOnUiThread);
        PrayerAlerts.schedule(this);
        web.loadUrl(ORIGIN + "/");
    }
    private void notifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 12);
    }
    private List<QuranQueue.Track> tracks(JSONObject command) throws JSONException {
        String mode = command.getString("mode");
        return catalog.build(command.getInt("chapter"), command.getInt("verse"), mode,
            command.optBoolean("singleVerse", false), command.optString("part", QuranQueue.parts(mode).get(0)));
    }
    private void execute(JSONObject command) {
        try {
            String action = command.getString("action");
            if (action.equals("download")) {
                notifications();
                List<QuranQueue.Track> tracks = tracks(command);
                for (QuranQueue.Track track : tracks) {
                    DownloadRequest request = new DownloadRequest.Builder(track.url(), Uri.parse(track.url())).setMimeType("audio/mpeg").build();
                    DownloadService.sendAddDownload(this, QuranDownloadService.class, request, true);
                }
                DownloadService.sendResumeDownloads(this, QuranDownloadService.class, true);
            } else if (action.equals("clearDownloads")) {
                DownloadService.sendRemoveAllDownloads(this, QuranDownloadService.class, true);
            } else if (action.equals("pauseDownloads")) {
                DownloadService.sendPauseDownloads(this, QuranDownloadService.class, false);
            } else {
                if (controller == null) { pendingCommand = command; return; }
                failure = "";
                switch (action) {
                    case "play" -> {
                        notifications();
                        ArrayList<MediaItem> items = new ArrayList<>();
                        for (QuranQueue.Track track : tracks(command)) items.add(PlaybackService.item(track));
                        double seconds = command.optDouble("seconds", 0);
                        if (!Double.isFinite(seconds) || seconds < 0 || seconds > 86400) throw new IllegalArgumentException("Invalid listening position");
                        controller.setMediaItems(items, 0, (long)(seconds * 1000));
                        controller.setPlaybackSpeed(speed(command));
                        controller.prepare();
                        controller.setPlayWhenReady(command.optBoolean("start", true));
                    }
                    case "resume" -> { controller.prepare(); controller.play(); }
                    case "pause" -> controller.pause();
                    case "stop" -> { controller.stop(); controller.clearMediaItems(); }
                    case "speed" -> controller.setPlaybackSpeed(speed(command));
                    case "seek" -> {
                        MediaItem current = controller.getCurrentMediaItem();
                        // A late WebView gesture must not seek a different verse or language.
                        if (current == null || !current.mediaId.equals(command.optString("track"))) break;
                        double seconds = command.optDouble("seconds", -1);
                        long duration = controller.getDuration();
                        if (!Double.isFinite(seconds) || seconds < 0 || seconds > 86400) throw new IllegalArgumentException("Invalid listening position");
                        if (duration > 0) controller.seekTo(Math.min((long)(seconds * 1000), Math.max(0, duration - 100)));
                    }
                    default -> throw new IllegalArgumentException("Unknown audio command");
                }
            }
        } catch (Exception error) { failure = "Audio request failed: " + (error.getMessage() == null ? "please try again" : error.getMessage()); }
        publish();
    }
    private float speed(JSONObject command) {
        double value = command.optDouble("speed", 1);
        if (!Double.isFinite(value) || value < .75 || value > 1.5) throw new IllegalArgumentException("Invalid speed");
        return (float)value;
    }
    private void publish() {
        try {
            JSONObject json = new JSONObject().put("ready", controller != null).put("error", failure).put("downloads", new JSONObject(downloadState));
            if (controller != null && controller.getCurrentMediaItem() != null) {
                String[] id = controller.getCurrentMediaItem().mediaId.split(":");
                json.put("chapter", Integer.parseInt(id[0])).put("verse", Integer.parseInt(id[1])).put("mode", id[2]).put("part", id[3])
                    .put("singleVerse", Boolean.parseBoolean(id[4])).put("seconds", Math.max(0, controller.getCurrentPosition()) / 1000.0)
                    .put("duration", Math.max(0, controller.getDuration()) / 1000.0).put("playing", controller.getPlayWhenReady())
                    .put("buffering", controller.getPlaybackState() == Player.STATE_BUFFERING)
                    .put("finished", controller.getPlaybackState() == Player.STATE_ENDED).put("speed", controller.getPlaybackParameters().speed);
                if (controller.getPlayerError() != null) json.put("error", "Recording unavailable. Connect to the internet or download this surah, then retry.").put("playing", false);
            }
            state = json.toString();
            if (visible && web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('akhlaq-native-state',{detail:" + state + "}))", null);
            if (System.currentTimeMillis() - lastDownloads > 5000) {
                lastDownloads = System.currentTimeMillis();
                worker.execute(() -> {
                    try {
                        int completed = 0, pending = 0, failed = 0;
                        try (DownloadCursor cursor = AudioStore.downloads(this).getDownloadIndex().getDownloads()) {
                            while (cursor.moveToNext()) { int status = cursor.getDownload().state;
                                if (status == Download.STATE_COMPLETED) completed++;
                                else if (status == Download.STATE_FAILED) failed++;
                                else pending++;
                            }
                        }
                        downloadState = new JSONObject().put("completed", completed).put("pending", pending).put("failed", failed)
                            .put("bytes", AudioStore.bytes(this)).toString();
                    } catch (Exception ignored) { }
                });
            }
        } catch (Exception ignored) { }
    }
    private class Bridge {
        @JavascriptInterface public void alerts(String value) {
            if(value==null||value.length()>180000)return;
            runOnUiThread(()->{if(web==null)return;try{JSONObject config=new JSONObject(value);if(config.optBoolean("explicit")&&!config.optString("mode").equals("off"))notifications();String result=PrayerAlerts.configure(MainActivity.this,value);web.evaluateJavascript("window.dispatchEvent(new CustomEvent('akhlaq-alert-status',{detail:"+JSONObject.quote(result)+"}))",null);}catch(Exception e){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('akhlaq-alert-status',{detail:'Could not schedule alerts.'}))",null);}});
        }
        @JavascriptInterface public void alarmAccess(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=31&&!PrayerAlerts.precise(MainActivity.this))startActivity(new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));});}
        @JavascriptInterface public String narrationStatus(){return NarrationService.state;}
        @JavascriptInterface public void narrate(String value){if(value==null||value.length()>40000)return;runOnUiThread(()->{try{JSONObject v=new JSONObject(value);String action=v.getString("action");Intent i=new Intent(MainActivity.this,NarrationService.class).setAction(action);if(action.equals("play")){notifications();if(controller!=null)controller.pause();i.putExtra("title",v.getString("title")).putExtra("id",v.getString("id")).putExtra("text",v.getString("text"));startForegroundService(i);}else if(action.equals("toggle"))startService(i);else if(action.equals("stop")){NarrationService.state="{}";stopService(i);}}catch(Exception ignored){}});}
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }
        @JavascriptInterface public void eraseData() {
            runOnUiThread(() -> new AlertDialog.Builder(MainActivity.this)
                .setTitle("Erase all Akhlaq data?")
                .setMessage("This stops audio and deletes settings, saved verses, listening history, prayer logs, reflections and downloaded audio. Export a practice backup first if you want to keep it. Files you exported outside Akhlaq are not deleted. The app will close.")
                .setNegativeButton("Keep my data", null)
                .setPositiveButton("Erase data", (dialog, which) -> {
                    if (controller != null) { controller.stop(); controller.clearMediaItems(); }
                    ((ActivityManager)getSystemService(ACTIVITY_SERVICE)).clearApplicationUserData();
                }).show());
        }
        @JavascriptInterface public String status() { return state; }
        @JavascriptInterface public void command(String json) {
            if (json == null || json.length() > 4096) return;
            runOnUiThread(() -> { try { execute(new JSONObject(json)); } catch (JSONException ignored) { } });
        }
        @JavascriptInterface public void requestLocation(String id) {
            if (id == null || !id.matches("[a-zA-Z0-9-]{1,80}")) return;
            runOnUiThread(() -> {
                if (!visible) { locationError(id, "cancelled", "Open Akhlaq to request location.", ""); return; }
                currentLocation.cancel();
                if (pendingLocation != null) locationError(pendingLocation, "cancelled", "Location request replaced.", "");
                pendingLocation = id;
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) startPendingLocation();
                else requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 14);
            });
        }
        @JavascriptInterface public void cancelLocation(String id) {
            runOnUiThread(() -> { if (Objects.equals(id, pendingLocation)) pendingLocation = null; currentLocation.cancel(id); });
        }
        @JavascriptInterface public void locationSettings(String target) {
            runOnUiThread(() -> { try {
                Intent intent = "app".equals(target) ? new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())) : new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                startActivity(intent);
            } catch (Exception ignored) { android.widget.Toast.makeText(MainActivity.this, "Open Android Settings → Location", android.widget.Toast.LENGTH_LONG).show(); } });
        }
        @JavascriptInterface public void compass(boolean enabled) {
            runOnUiThread(() -> { if (enabled && visible) compassSensors.start(); else compassSensors.stop(); });
        }
        @JavascriptInterface public void qiblaAligned() {
            runOnUiThread(() -> {
                long now = SystemClock.elapsedRealtime();
                if (!visible || web == null || !web.isShown() || !compassSensors.isRunning() || now - lastQiblaBuzz < 4000) return;
                lastQiblaBuzz = now;
                web.performHapticFeedback(Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY);
            });
        }

        @JavascriptInterface public void exportFile(String name, String text, String mime) {
            if (name == null || mime == null || text == null || text.length() > 4000000 || !(mime.split(";")[0].equals("application/json") || mime.split(";")[0].equals("text/calendar"))) { exportResult(name, "error"); return; }
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 4000000) { exportResult(name, "error"); return; }
            runOnUiThread(() -> {
                if (exportBytes != null) { exportResult(name, "busy"); return; }
                exportBytes = bytes; exportName = name;
                try { startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mime.split(";")[0]).putExtra(Intent.EXTRA_TITLE, name.replaceAll("[^a-zA-Z0-9._-]", "_")), 13); }
                catch (Exception ignored) { exportBytes = null; exportName = null; exportResult(name, "error"); }
            });
        }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 14 && pendingLocation != null) {
            if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) startPendingLocation();
            else { String id = pendingLocation; pendingLocation = null; locationError(id, "permission", "Location permission was not allowed. You can allow it in app settings and retry.", "app"); }
        }
        if (request == 12 && web != null) web.evaluateJavascript("window.dispatchEvent(new Event('akhlaq-alert-refresh'))", null);
        if (request == 10 && geoCallback != null) {
            geoCallback.invoke(geoOrigin, checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED, false);
            geoCallback = null;
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent intent) {
        super.onActivityResult(request, result, intent);
        if (request == 11 && fileCallback != null) { fileCallback.onReceiveValue(result == RESULT_OK && intent != null ? new Uri[]{intent.getData()} : null); fileCallback = null; }
        if (request == 13) {
            byte[] bytes = exportBytes; String name = exportName; exportBytes = null; exportName = null;
            if (bytes == null) return;
            if (result != RESULT_OK || intent == null || intent.getData() == null) { exportResult(name, "cancelled"); return; }
            worker.execute(() -> {
                try {
                    try (OutputStream output = getContentResolver().openOutputStream(intent.getData())) { if (output == null) throw new IOException("No output stream"); output.write(bytes); }
                    exportResult(name, "saved");
                } catch (Exception error) { exportResult(name, "error"); }
            });
        }
    }
    @Override protected void onResume() { super.onResume(); visible = true; startPendingLocation(); if (web != null) { web.onResume(); web.evaluateJavascript("window.dispatchEvent(new Event('akhlaq-alert-refresh'))", null); } handler.post(tick); }
    @Override protected void onPause() { visible = false; currentLocation.cancel(); handler.removeCallbacks(tick); compassSensors.stop(); if (web != null) web.onPause(); super.onPause(); }
    private void navigateBack() { if (web != null && web.canGoBack()) web.goBack(); else moveTaskToBack(true); }
    @Override public void onBackPressed() { navigateBack(); }
    @Override protected void onDestroy() {
        visible = false; pendingLocation = null; currentLocation.cancel(); handler.removeCallbacksAndMessages(null); compassSensors.stop();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (geoCallback != null) geoCallback.invoke(geoOrigin, false, false);
        MediaController.releaseFuture(controllerFuture);
        if (web != null) { web.removeJavascriptInterface("AkhlaqNative"); web.destroy(); web = null; }
        worker.shutdown();
        super.onDestroy();
    }
}
