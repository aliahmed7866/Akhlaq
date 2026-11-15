package uk.akhlaq.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.media3.exoplayer.offline.*;
import androidx.media3.exoplayer.scheduler.Scheduler;
import java.util.List;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public class QuranDownloadService extends DownloadService {
    public QuranDownloadService() { super(1002, DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL, "akhlaq-downloads", R.string.download_channel, 0); }
    @Override protected DownloadManager getDownloadManager() { return AudioStore.downloads(this); }
    @Override protected Scheduler getScheduler() { return null; }
    @Override public void onTimeout(int startId, int foregroundServiceType) {
        // Android 15+ limits background data-sync time. Pause until the user resumes.
        getDownloadManager().pauseDownloads();
        stopSelf();
    }
    @Override protected Notification getForegroundNotification(List<Download> downloads, int unmetRequirements) {
        PendingIntent open = PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new DownloadNotificationHelper(this, "akhlaq-downloads").buildProgressNotification(this,
            R.drawable.ic_akhlaq, open, "Quran audio for offline listening", downloads, unmetRequirements);
    }
}
