package uk.akhlaq.app;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import org.json.*;

/** One pending alarm; persisted UTC instants survive process exit and reboot. */
public final class PrayerAlerts extends BroadcastReceiver {
    private static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("prayer-alerts", Context.MODE_PRIVATE); }
    private static PendingIntent pending(Context c) { return PendingIntent.getBroadcast(c, 840, new Intent(c, PrayerAlerts.class).setAction("uk.akhlaq.PRAYER"), PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT); }
    public static boolean precise(Context c) { return Build.VERSION.SDK_INT<31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms(); }
    public static String configure(Context c, String json) throws JSONException {
        JSONObject value=new JSONObject(json); String mode=value.getString("mode");
        if(!java.util.List.of("off","gentle","adhan").contains(mode))throw new JSONException("Invalid alert mode");
        JSONArray valid=PrayerAlertPlan.future(value.getJSONArray("events"),System.currentTimeMillis());
        prefs(c).edit().putString("mode",mode).putString("events",valid.toString()).apply();schedule(c);
        if(mode.equals("off"))return "Prayer alerts are off.";
        if(!c.getSystemService(NotificationManager.class).areNotificationsEnabled())return "Alerts saved, but Android notifications are blocked. Allow notifications in app settings.";
        if(valid.length()==0)return "No future alerts selected. Select at least one prayer.";
        long until=valid.getJSONObject(valid.length()-1).getLong("at");
        return valid.length()+" alerts prepared through "+java.text.DateFormat.getDateInstance().format(new java.util.Date(until))+(precise(c)?". Precise timing allowed.":". Timing is approximate until you allow precise alarms.");
    }
    @android.annotation.SuppressLint("ScheduleExactAlarm")
    public static void schedule(Context c) {
        AlarmManager alarms=c.getSystemService(AlarmManager.class);alarms.cancel(pending(c));
        if(prefs(c).getString("mode","off").equals("off"))return;
        try {JSONArray list=new JSONArray(prefs(c).getString("events","[]"));long now=System.currentTimeMillis();for(int i=0;i<list.length();i++){long at=list.getJSONObject(i).getLong("at");if(at>now){prefs(c).edit().putString("next",list.getJSONObject(i).toString()).apply();try{if(precise(c))alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(c));else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(c));}catch(SecurityException e){alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending(c));}return;}}prefs(c).edit().remove("next").apply();}catch(JSONException ignored) { }
    }
    @Override public void onReceive(Context c, Intent intent) {
        if("uk.akhlaq.PRAYER".equals(intent.getAction()) && !prefs(c).getString("mode","off").equals("off")) {
            try { JSONObject e=new JSONObject(prefs(c).getString("next","{}"));long delta=System.currentTimeMillis()-e.getLong("at");
                if(delta>=0&&delta<15*60000){NotificationManager nm=c.getSystemService(NotificationManager.class);boolean adhan=prefs(c).getString("mode","gentle").equals("adhan")&&!e.optBoolean("early");String channel=adhan?"prayer-adhan-v1":"prayer-gentle-v1";
                    NotificationChannel ch=new NotificationChannel(channel,adhan?"Prayer adhan":"Prayer reminders",NotificationManager.IMPORTANCE_HIGH);
                    if(adhan)ch.setSound(Uri.parse("android.resource://"+c.getPackageName()+"/"+R.raw.adhan),new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
                    nm.createNotificationChannel(ch);
                    PendingIntent open=PendingIntent.getActivity(c,841,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
                    if(Build.VERSION.SDK_INT>=33 && c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){schedule(c);return;}
                    nm.notify(842,new Notification.Builder(c,channel).setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle(e.getString("title")).setContentText("Based on your saved location and prayer method").setContentIntent(open).setAutoCancel(true).build());
                }
            }catch(JSONException|SecurityException ignored) { }
        }
        schedule(c);
    }
}
