package uk.akhlaq.app;
import org.json.*;
/** Validation shared by the Android scheduler and its host-side tests. */
public final class PrayerAlertPlan {
    public static JSONArray future(JSONArray input,long now) throws JSONException {
        if(input.length()>1000)throw new JSONException("Too many alerts");
        JSONArray result=new JSONArray();long previous=0;
        for(int i=0;i<input.length();i++){
            JSONObject e=input.getJSONObject(i);long at=e.getLong("at");String title=e.getString("title");
            if(at<previous||at>now+92L*86400000||title.isBlank()||title.length()>100)throw new JSONException("Invalid alert");
            previous=at;if(at>now)result.put(new JSONObject().put("at",at).put("title",title).put("early",e.optBoolean("early")));
        }
        return result;
    }
}
