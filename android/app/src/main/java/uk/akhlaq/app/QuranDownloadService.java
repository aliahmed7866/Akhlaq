package uk.akhlaq.app;

import android.app.Notification;
import androidx.media3.exoplayer.offline.*;
import androidx.media3.exoplayer.scheduler.Scheduler;
import java.util.List;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public class QuranDownloadService extends DownloadService {
    public QuranDownloadService() { super(1002, DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL, "akhlaq-downloads", R.string.download_channel, 0); }
    @Override protected DownloadManager getDownloadManager() { return AudioStore.downloads(this); }
    @Override protected Scheduler getScheduler() { return null; }
    @Override protected Notification getForegroundNotification(List<Download> downloads, int unmetRequirements) {
        return new DownloadNotificationHelper(this, "akhlaq-downloads").buildProgressNotification(this,
            R.drawable.ic_akhlaq, null, "Quran audio for offline listening", downloads, unmetRequirements);
    }
}
