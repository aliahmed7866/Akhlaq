package uk.akhlaq.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.*;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.matcher.ViewMatchers.withText;
import static androidx.test.espresso.action.ViewActions.click;

/** Real bundled WebView + Android bridge, with the emulator network disabled by CI. */
@RunWith(AndroidJUnit4.class)
public class ReleaseSmokeTest {
    private ActivityScenario<MainActivity> activity;
    private WebView find(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) for (int i=0; i<((ViewGroup)view).getChildCount(); i++) {
            WebView found=find(((ViewGroup)view).getChildAt(i)); if (found!=null) return found;
        }
        return null;
    }
    private String js(String expression) throws Exception {
        CountDownLatch done=new CountDownLatch(1); AtomicReference<String> result=new AtomicReference<>();
        activity.onActivity(a -> { WebView web=find(a.getWindow().getDecorView());
            if (web==null) { done.countDown(); return; }
            web.evaluateJavascript(expression, value -> { result.set(value); done.countDown(); });
        });
        assertTrue("WebView response timed out: "+expression,done.await(5,TimeUnit.SECONDS)); return result.get();
    }
    private void until(String expression) throws Exception {
        long end=SystemClock.elapsedRealtime()+25000;
        do { if ("true".equals(js("Boolean("+expression+")"))) return; SystemClock.sleep(100); }
        while (SystemClock.elapsedRealtime()<end);
        fail("Not ready: "+expression+"; last result="+js(expression));
    }
    private void route(String hash) throws Exception { js("location.hash='"+hash+"'"); until("location.hash==='#"+hash+"'"); }
    @Before public void launch() throws Exception {
        activity=ActivityScenario.launch(MainActivity.class);
        until("document.querySelectorAll('#prayers li').length===6");
        // A fragment-only location.replace does not reload the document. Recreate
        // the activity so every test gets fresh JS state after clearing Web storage.
        js("localStorage.clear();window.__previousTestDocument=true");
        activity.recreate();
        until("document.querySelectorAll('#prayers li').length===6 && !window.__previousTestDocument");
        route("home");
    }
    @After public void close() { if (activity!=null) activity.close(); }
    @Test public void offlineReaderHadithAndPrivacy() throws Exception {
        route("quran/1:1"); until("document.querySelectorAll('.ayah').length===7");
        js("document.querySelector('[data-reader-preset=arabic-urdu]').click()");
        until("document.querySelector('.ayah-urdu')?.textContent.length>10");
        assertEquals("true",js("document.querySelector('#quran-audio').paused"));
        route("learn/hadith/5351"); until("document.querySelector('#hadith-list details[open] .hadith-body')?.textContent.length>50");
        js("document.querySelector('#hadith-language').value='ur';document.querySelector('#hadith-language').dispatchEvent(new Event('change'))");
        until("document.querySelector('#hadith-list .hadith-translation[lang=ur]')?.textContent.length>20");
        js("location.href='/privacy.html'"); until("document.querySelector('h1')?.textContent==='Akhlaq privacy policy'");
        assertEquals("true",js("document.body.textContent.includes('Retention and deletion')"));
    }
    @Test public void savedVersesSurviveActivityRecreation() throws Exception {
        route("quran/1:1"); until("document.querySelectorAll('.ayah').length===7");
        js("document.querySelector('[data-bookmark=\"1\"]').click()");
        activity.recreate(); until("document.querySelectorAll('#prayers li').length===6");
        route("quran/1:1"); until("document.querySelectorAll('.ayah').length===7");
        js("document.querySelector('#reader-saved-open').click()");
        until("document.querySelectorAll('#quran-saved-list li').length===1");
    }
    @Test public void cancellationDoesNotClaimTheBackupWasSaved() throws Exception {
        route("settings"); js("document.querySelector('#export-backup').closest('details').open=true;document.querySelector('#export-backup').click()");
        // The native Documents UI owns focus, so do not evaluate JS until it has closed.
        SystemClock.sleep(1500);
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        until("document.querySelector('#backup-status').textContent.includes('Save cancelled')");
    }
    @Test public void largeTextReflowsAcrossMainScreens() throws Exception {
        js("document.documentElement.style.fontSize='32px'");
        for (String hash:new String[]{"home","quran/1:1","qibla","practice","dhikr","settings","learn/hadith/5351","essentials/kalimat"}) {
            route(hash); SystemClock.sleep(300);
            assertEquals(hash,"true",js("document.documentElement.scrollWidth<=innerWidth+1"));
        }
    }
    @Test public void rendererRecoveryPreservesRecords() throws Exception {
        js("localStorage.setItem('akhlaq-recovery-test','retained')");
        activity.onActivity(a -> {
            WebView web=find(a.getWindow().getDecorView());
            assertNotNull(web.getWebViewRenderProcess()); assertTrue(web.getWebViewRenderProcess().terminate());
        });
        SystemClock.sleep(1500);
        onView(withText("Reopen")).perform(click());
        until("document.querySelectorAll('#prayers li').length===6");
        assertEquals("\"retained\"",js("localStorage.getItem('akhlaq-recovery-test')"));
    }
    @Test public void captureActualAndroidScreens() throws Exception {
        // These are emulator captures of real app content, with no fake bridge or sensor samples.
        route("home"); capture("01-today");
        route("quran/1:1"); until("document.querySelectorAll('.ayah').length===7");
        js("document.querySelector('[data-reader-preset=arabic-urdu]').click()");
        until("document.querySelector('.ayah-urdu')?.textContent.length>10");
        js("document.querySelector('#reader-focus').click()"); capture("02-quran-urdu");
        route("learn/hadith/5351"); until("document.querySelector('#hadith-list details[open] .hadith-body')?.textContent.length>50"); capture("03-hadith");
        route("essentials/duas"); until("document.querySelector('#companion-content')?.textContent.length>50"); capture("04-duas");
    }
    private void capture(String name) throws Exception {
        js("window.scrollTo(0,0)"); SystemClock.sleep(700);
        Bitmap bitmap=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap); File folder=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(),"store-captures");
        assertTrue(folder.isDirectory() || folder.mkdirs());
        try (OutputStream out=new FileOutputStream(new File(folder,name+".png"))) { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,out)); }
        bitmap.recycle();
    }
}
