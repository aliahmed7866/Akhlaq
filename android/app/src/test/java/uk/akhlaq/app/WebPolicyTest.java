package uk.akhlaq.app;

import android.net.Uri;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, manifest = Config.NONE)
public class WebPolicyTest {
    @Test public void onlyTheExactSecureAssetOriginIsTrusted() {
        assertTrue(MainActivity.local(Uri.parse("https://appassets.androidplatform.net/")));
        assertTrue(MainActivity.local(Uri.parse("https://appassets.androidplatform.net:443/privacy.html")));
        for (String url : new String[]{
            "http://appassets.androidplatform.net/", "https://appassets.androidplatform.net:8443/",
            "https://someone@appassets.androidplatform.net/", "https://appassets.androidplatform.net.evil.example/",
            "https://appassets.androidplatform.net@evil.example/", "https://quranenc.com/",
            "file:///android_asset/index.html", "javascript:alert(1)", "about:blank"
        }) assertFalse(url, MainActivity.local(Uri.parse(url)));
    }
}
