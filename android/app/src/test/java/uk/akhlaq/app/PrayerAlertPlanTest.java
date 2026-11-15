package uk.akhlaq.app;
import org.junit.Test;import org.json.*;import static org.junit.Assert.*;
public class PrayerAlertPlanTest {
 @Test public void removesExpiredAndPreservesAdvanceFlag() throws Exception {
  JSONArray input=new JSONArray("[{\"at\":900,\"title\":\"Expired\"},{\"at\":2000,\"title\":\"Fajr soon\",\"early\":true},{\"at\":3000,\"title\":\"Fajr\"}]");
  JSONArray result=PrayerAlertPlan.future(input,1000);assertEquals(2,result.length());assertTrue(result.getJSONObject(0).getBoolean("early"));assertFalse(result.getJSONObject(1).getBoolean("early"));
 }
 @Test(expected=JSONException.class) public void rejectsUnsorted() throws Exception {PrayerAlertPlan.future(new JSONArray("[{\"at\":3000,\"title\":\"A\"},{\"at\":2000,\"title\":\"B\"}]"),1000);}
 @Test(expected=JSONException.class) public void rejectsUnboundedFuture() throws Exception {PrayerAlertPlan.future(new JSONArray().put(new JSONObject().put("at",Long.MAX_VALUE).put("title","Fajr")),1000);}
 @Test public void emptyPlanIsSafe() throws Exception {assertEquals(0,PrayerAlertPlan.future(new JSONArray(),1000).length());}
}
