package uk.akhlaq.app;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.List;

public class QuranQueueTest {
    private QuranQueue catalog() throws Exception {
        return new QuranQueue("{\"chapters\":[{\"name\":\"Al-Fatiha\",\"ayahs\":[[1],[2],[3]]},{\"name\":\"Al-Baqara\",\"ayahs\":[[8],[9]]}]}");
    }
    @Test public void pairedQueueDoesNotNeedTheActivityToAdvance() throws Exception {
        var queue = catalog().build(1, 2, "arabic-urdu", false, "arabic");
        assertEquals(4, queue.size());
        assertEquals(List.of("arabic", "urdu", "arabic", "urdu"), queue.stream().map(QuranQueue.Track::part).toList());
        assertEquals(List.of(2, 2, 3, 3), queue.stream().map(QuranQueue.Track::verse).toList());
        assertTrue(queue.get(0).url().endsWith("/ar.alafasy/2.mp3"));
        assertTrue(queue.get(1).url().endsWith("/001002.mp3"));
    }
    @Test public void resumeTranslationThenStartNextVerseInArabic() throws Exception {
        var queue = catalog().build(2, 1, "both", false, "english");
        assertEquals(3, queue.size());
        assertTrue(queue.get(0).url().endsWith("/english_rwwad/002001.mp3"));
        assertTrue(queue.get(1).url().endsWith("/ar.alafasy/9.mp3"));
        assertEquals("2:1:both:english:false", queue.get(0).id());
    }
    @Test public void singleVerseFinishesBothPartsAndStandaloneUrduHasNoArabic() throws Exception {
        assertEquals(2, catalog().build(1, 1, "arabic-urdu", true, "arabic").size());
        assertEquals(1, catalog().build(1, 1, "arabic-urdu", true, "urdu").size());
        assertTrue(catalog().build(1, 1, "urdu", false, "urdu").stream().allMatch(t -> t.part().equals("urdu")));
    }
    @Test public void invalidBridgeRequestsCannotChooseArbitrarySources() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> catalog().build(0, 1, "both", false, "arabic"));
        assertThrows(IllegalArgumentException.class, () -> catalog().build(1, 99, "both", false, "arabic"));
        assertThrows(IllegalArgumentException.class, () -> catalog().build(1, 1, "https://other.example", false, "arabic"));
        assertThrows(IllegalArgumentException.class, () -> catalog().build(1, 1, "urdu", false, "arabic"));
    }
}
