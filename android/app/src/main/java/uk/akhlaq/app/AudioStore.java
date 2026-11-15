package uk.akhlaq.app;

import android.content.Context;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.cache.*;
import androidx.media3.exoplayer.offline.DownloadManager;
import java.io.File;
import java.util.concurrent.Executors;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public final class AudioStore {
    private static SimpleCache cache;
    private static DownloadManager downloads;
    private static DefaultHttpDataSource.Factory upstream() {
        return new DefaultHttpDataSource.Factory().setUserAgent("Akhlaq Android/" + BuildConfig.VERSION_NAME)
            .setConnectTimeoutMs(20000).setReadTimeoutMs(30000);
    }
    public static synchronized DownloadManager downloads(Context context) {
        if (downloads == null) {
            Context app = context.getApplicationContext();
            StandaloneDatabaseProvider database = new StandaloneDatabaseProvider(app);
            cache = new SimpleCache(new File(app.getFilesDir(), "quran-audio"), new NoOpCacheEvictor(), database);
            downloads = new DownloadManager(app, database, cache, upstream(), Executors.newFixedThreadPool(2));
            downloads.setMaxParallelDownloads(2);
        }
        return downloads;
    }
    public static synchronized CacheDataSource.Factory playback(Context context) {
        downloads(context);
        // Streaming reads existing downloads without silently filling phone storage.
        return new CacheDataSource.Factory().setCache(cache).setUpstreamDataSourceFactory(upstream())
            .setCacheWriteDataSinkFactory(null).setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
    }
    public static synchronized long bytes(Context context) { downloads(context); return cache.getCacheSpace(); }
}
