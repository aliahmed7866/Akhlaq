package uk.akhlaq.app;
import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
import android.speech.tts.*;
import java.util.*;
import org.json.*;

/** Offline device narration of original app summaries. Resume repeats the current sentence. */
public class NarrationService extends Service {
    private TextToSpeech speech;private boolean ready,paused=true;private String title="",id="";private String[] chunks={};private int index;private int generation;
    private AudioManager audio;private AudioFocusRequest focus;
    private final Handler handler=new Handler(Looper.getMainLooper());
    public static volatile String state="{}";
    private void publish(String status){try{state=new JSONObject().put("title",title).put("status",status).toString();}catch(JSONException ignored){}}
    private void checkpoint(){getSharedPreferences("narration",MODE_PRIVATE).edit().putString("id",id).putInt("index",index).apply();}
    @Override public void onCreate(){super.onCreate();audio=getSystemService(AudioManager.class);
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()).setOnAudioFocusChangeListener(change->{if(change<0)pause();}).build();
        speech=new TextToSpeech(this,result->handler.post(()->{if(result!=TextToSpeech.SUCCESS){publish("Speech engine unavailable.");stopSelf();return;}Voice v=(speech.getVoices()==null?java.util.Collections.<Voice>emptySet():speech.getVoices()).stream().filter(x->x.getLocale().getLanguage().equals("en")&&!x.isNetworkConnectionRequired()&&(x.getFeatures()==null||!x.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))).findFirst().orElse(null);if(v==null){publish("Install an offline English voice in Android text-to-speech settings.");stopSelf();return;}speech.setVoice(v);ready=true;if(!paused)speak();}));
        speech.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String value){}public void onError(String value){handler.post(()->{pause();publish("Narration unavailable. Check your device voice.");});}public void onDone(String value){handler.post(()->{if(!value.equals(generation+":"+index)||paused)return;index++;checkpoint();speak();});}});
    }
    private void notification(){NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("story-reader","Story narration",NotificationManager.IMPORTANCE_LOW));
        PendingIntent toggle=PendingIntent.getService(this,850,new Intent(this,NarrationService.class).setAction("toggle"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop=PendingIntent.getService(this,851,new Intent(this,NarrationService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent open=PendingIntent.getActivity(this,852,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        startForeground(850,new Notification.Builder(this,"story-reader").setSmallIcon(android.R.drawable.ic_media_play).setContentTitle(title.isEmpty()?"Story narration":title).setContentText(paused?"Paused · resumes current sentence":"Reading original cited summary").setContentIntent(open).setOngoing(!paused).addAction(new Notification.Action.Builder(null,paused?"Resume":"Pause",toggle).build()).addAction(new Notification.Action.Builder(null,"Stop",stop).build()).build());
    }
    private void pause(){paused=true;generation++;if(speech!=null)speech.stop();checkpoint();publish("Paused · resumes current sentence");notification();}
    private void speak(){if(!ready||paused)return;if(index>=chunks.length){publish("Finished");getSharedPreferences("narration",MODE_PRIVATE).edit().clear().apply();stopSelf();return;}if(audio.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){pause();publish("Audio is busy. Try Resume.");return;}publish("Reading · "+(index+1)+" of "+chunks.length);speech.speak(chunks[index],TextToSpeech.QUEUE_FLUSH,null,generation+":"+index);notification();}
    @Override public int onStartCommand(Intent intent,int flags,int startId){if(intent==null){stopSelf();return START_NOT_STICKY;}String action=intent.getAction();notification();
        if("stop".equals(action)){state="{}";stopSelf();return START_NOT_STICKY;}
        if("toggle".equals(action)){if(paused){paused=false;speak();}else pause();return START_NOT_STICKY;}
        if("play".equals(action)){String text=intent.getStringExtra("text");if(text==null||text.length()>30000){stopSelf();return START_NOT_STICKY;}generation++;speech.stop();title=intent.getStringExtra("title");id=intent.getStringExtra("id");chunks=text.split("(?<=[.!?])\\s+|\\n+");index=id.equals(getSharedPreferences("narration",MODE_PRIVATE).getString("id",""))?getSharedPreferences("narration",MODE_PRIVATE).getInt("index",0):0;if(index<0||index>=chunks.length)index=0;paused=false;publish("Preparing offline English voice…");notification();speak();}
        return START_NOT_STICKY;
    }
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onDestroy(){paused=true;generation++;if(speech!=null){speech.stop();speech.shutdown();}audio.abandonAudioFocusRequest(focus);stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
