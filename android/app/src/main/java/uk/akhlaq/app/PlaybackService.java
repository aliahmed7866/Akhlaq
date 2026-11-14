package uk.akhlaq.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.*;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public class PlaybackService extends MediaSessionService {
    private MediaSession session;
    private ExoPlayer player;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable checkpoint = new Runnable() {
        public void run() { save(); handler.postDelayed(this, 5000); }
    };
    public static MediaItem item(QuranQueue.Track track) {
        return new MediaItem.Builder().setMediaId(track.id()).setUri(track.url())
            .setMediaMetadata(new MediaMetadata.Builder().setTitle(track.name() + " " + track.chapter() + ":" + track.verse())
                .setArtist(switch(track.part()) { case "arabic" -> "Arabic · Mishary Alafasy"; case "urdu" -> "Urdu · Shamshad Ali Khan"; default -> "English · Rowwad"; })
                .setAlbumTitle("Akhlaq · Quran").build()).build();
    }
    @Override public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(AudioStore.playback(this)))
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
            .setHandleAudioBecomingNoisy(true).setWakeMode(C.WAKE_MODE_NETWORK).build();
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        session = new MediaSession.Builder(this, player).setSessionActivity(open).build();
        restore();
        player.addListener(new Player.Listener() {
            @Override public void onEvents(Player p, Player.Events events) { save(); }
        });
        handler.postDelayed(checkpoint, 5000);
    }
    @Override public MediaSession onGetSession(MediaSession.ControllerInfo controller) {
        return getPackageName().equals(controller.getPackageName()) || controller.isTrusted() ? session : null;
    }
    private void save() {
        try {
            MediaItem item = player.getCurrentMediaItem();
            if (item == null || player.getPlaybackState() == Player.STATE_ENDED) {
                getSharedPreferences("listening", MODE_PRIVATE).edit().remove("point").apply(); return;
            }
            JSONObject point = new JSONObject().put("id", item.mediaId).put("position", Math.max(0, player.getCurrentPosition()))
                .put("speed", player.getPlaybackParameters().speed);
            getSharedPreferences("listening", MODE_PRIVATE).edit().putString("point", point.toString()).apply();
        } catch (Exception ignored) { }
    }
    private void restore() {
        try {
            String value = getSharedPreferences("listening", MODE_PRIVATE).getString("point", "");
            if (value.isEmpty()) return;
            JSONObject point = new JSONObject(value);
            String[] id = point.getString("id").split(":");
            QuranQueue catalog = new QuranQueue(AssetText.read(this, "quran.json"));
            List<MediaItem> items = new ArrayList<>();
            for (QuranQueue.Track track : catalog.build(Integer.parseInt(id[0]), Integer.parseInt(id[1]), id[2], Boolean.parseBoolean(id[4]), id[3])) items.add(item(track));
            player.setMediaItems(items, 0, Math.max(0, point.optLong("position", 0)));
            player.setPlaybackSpeed((float)Math.max(.75, Math.min(1.5, point.optDouble("speed", 1))));
            // Reopening a stopped process restores a paused queue, never unexpected sound.
        } catch (Exception ignored) { getSharedPreferences("listening", MODE_PRIVATE).edit().remove("point").apply(); }
    }
    @Override public void onTaskRemoved(Intent rootIntent) {
        save();
        if (player.getPlayerError() != null || !player.getPlayWhenReady() || player.getMediaItemCount() == 0 || player.getPlaybackState() == Player.STATE_ENDED) stopSelf();
    }
    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        save();
        if (session != null) { player.release(); session.release(); }
        super.onDestroy();
    }
}
