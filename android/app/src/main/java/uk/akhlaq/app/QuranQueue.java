package uk.akhlaq.app;

import org.json.*;
import java.util.*;

/** The native service owns the entire queue, including each translation handoff. */
public final class QuranQueue {
    public record Track(int chapter, int verse, String mode, String part, boolean single, String name, String url) {
        public String id() { return chapter + ":" + verse + ":" + mode + ":" + part + ":" + single; }
    }
    private final JSONArray chapters;
    public QuranQueue(String json) throws JSONException { chapters = new JSONObject(json).getJSONArray("chapters"); }
    public static List<String> parts(String mode) {
        return switch (mode) {
            case "both" -> List.of("arabic", "english");
            case "arabic-urdu" -> List.of("arabic", "urdu");
            case "arabic", "english", "urdu" -> List.of(mode);
            default -> throw new IllegalArgumentException("Unknown playback mode");
        };
    }
    public List<Track> build(int chapter, int verse, String mode, boolean single, String firstPart) throws JSONException {
        if (chapter < 1 || chapter > chapters.length()) throw new IllegalArgumentException("Unknown surah");
        JSONObject surah = chapters.getJSONObject(chapter - 1);
        JSONArray verses = surah.getJSONArray("ayahs");
        if (verse < 1 || verse > verses.length()) throw new IllegalArgumentException("Unknown verse");
        List<String> languages = parts(mode);
        if (!languages.contains(firstPart)) throw new IllegalArgumentException("Unknown audio language");
        List<Track> tracks = new ArrayList<>();
        for (int n = verse; n <= (single ? verse : verses.length()); n++) {
            for (int p = n == verse ? languages.indexOf(firstPart) : 0; p < languages.size(); p++) {
                String part = languages.get(p);
                int global = verses.getJSONArray(n - 1).getInt(0);
                String file = String.format(Locale.ROOT, "%03d%03d.mp3", chapter, n);
                String url = switch (part) {
                    case "arabic" -> "https://cdn.islamic.network/quran/audio/128/ar.alafasy/" + global + ".mp3";
                    case "urdu" -> "https://everyayah.com/data/translations/urdu_shamshad_ali_khan_46kbps/" + file;
                    default -> "https://d.quranenc.com/data/audio/english_rwwad/" + file;
                };
                tracks.add(new Track(chapter, n, mode, part, single, surah.getString("name"), url));
            }
        }
        return tracks;
    }
}
