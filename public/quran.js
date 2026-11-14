const pageSize = 15;
const readerKey = 'akhlaq.reader.v1';
const urduEndpoint = '/api/quran/urdu';
const urduCache = 'akhlaq-quran-urdu-v1';
const displayModes = {
  both: ['ar', 'en'], 'arabic-urdu': ['ar', 'ur'], all: ['ar', 'en', 'ur'],
  english: ['en'], urdu: ['ur'], arabic: ['ar'],
};
const audioModes = ['both', 'english', 'arabic'];
const byId = id => document.getElementById(id);
const make = (tag, text) => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};

export function dailyVerse(chapters, day) {
  const number = Date.parse(day + 'T00:00:00Z') / 86400000;
  // A shuffled traversal gives the local day a stable choice with no consecutive repeats.
  const verseCount = chapters.reduce((total, chapter) => total + chapter.ayahs.length, 0);
  let index = ((number * 3877 + 2467) % verseCount + verseCount) % verseCount;
  for (const chapter of chapters) {
    if (index < chapter.ayahs.length) return { chapter: chapter.id, verse: index + 1 };
    index -= chapter.ayahs.length;
  }
}

function westernDigits(value) {
  return value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
}

export function verseReference(value, chapters) {
  const match = /^(\d{1,3})\s*:\s*(\d{1,3})$/.exec(westernDigits(value.trim()));
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  return verse >= 1 && verse <= (chapters[chapter - 1]?.ayahs.length || 0) ? { chapter, verse } : null;
}

function searchText(text) {
  return text.normalize('NFKD').toLowerCase().replace(/[\p{M}ـ]/gu, '')
    .replace(/ٱ/g, 'ا').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\[\d+\]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function findVerses(chapters, query, urdu, limit = 16) {
  const needle = searchText(query);
  const hits = [];
  if (needle.length < 2) return hits;
  for (const chapter of chapters) {
    for (const [index, [id, arabic, english]] of chapter.ayahs.entries()) {
      const candidates = [['en', english], ['ur', urdu?.verses[id - 1]?.[0]], ['ar', arabic]];
      const match = candidates.find(([, text]) => text && searchText(text).includes(needle));
      if (!match) continue;
      hits.push({ chapter: chapter.id, verse: index + 1, lang: match[0], text: match[1] });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

export function audioUrl(voice, chapter, verse, globalVerse) {
  const pad = value => String(value).padStart(3, '0');
  return voice === 'arabic'
    ? 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/' + globalVerse + '.mp3'
    : 'https://d.quranenc.com/data/audio/english_rwwad/' + pad(chapter) + pad(verse) + '.mp3';
}

export function readingBookmarks(saved, chapters) {
  const items = Array.isArray(saved.bookmarks) ? saved.bookmarks : [saved.bookmark];
  const references = new Map();
  for (const item of items) {
    const ref = item && verseReference(item.chapter + ':' + item.verse, chapters);
    if (ref) references.set(ref.chapter + ':' + ref.verse, ref);
  }
  return references;
}

export function savedAudioMode(reader) {
  // The old voice menu stored single-language choices before paired playback existed.
  return audioModes.includes(reader.audioMode) ? reader.audioMode : 'both';
}

export function nextAudioPart(mode, part, continueToNext, hasNextVerse) {
  if (mode === 'both' && part === 'arabic') return 'english';
  return continueToNext && hasNextVerse ? 'next-verse' : 'finished';
}

export function setupQuran({ stored, save, today }) {
  const status = byId('quran-status');
  const dailyText = byId('daily-text');
  const dailyLanguage = byId('daily-language');
  const select = byId('quran-chapter');
  const audio = byId('quran-audio');
  const player = byId('quran-player');
  const playerToggle = byId('player-toggle');
  const playerNext = byId('player-next');
  const playerMode = byId('player-mode');
  const size = byId('quran-size');
  const voiceSelect = byId('quran-voice');
  const language = byId('quran-language');
  const audioStatus = byId('quran-audio-status');
  const results = byId('quran-results');
  const list = byId('quran-verses');
  const playButton = byId('quran-play');
  let data;
  let urdu;
  let urduLoad;
  let urduMessage = '';
  let urduFailed = false;
  let loading;
  let shownDay;
  let route = '';
  let target = '';
  let saved = stored(readerKey);
  let selection;
  let daily;
  let bookmarks;
  let playing;
  let audioAttempt = 0;

  voiceSelect.value = savedAudioMode(saved);
  playerMode.value = voiceSelect.value;
  language.value = Object.hasOwn(displayModes, saved.language) ? saved.language : 'both';
  dailyLanguage.value = saved.dailyLanguage === 'ur' ? 'ur' : 'en';
  byId('quran-autoplay').checked = saved.autoplay !== false;
  size.value = ['large', 'extra'].includes(saved.size) ? saved.size : 'standard';
  byId('quran').dataset.size = size.value;
  function remember(fields) {
    saved = { ...saved, ...fields };
    return save(readerKey, saved);
  }
  function current() {
    return data.chapters[selection.chapter - 1];
  }
  const hashFor = ref => '#quran/' + ref.chapter + ':' + ref.verse;
  const reference = ref => data.chapters[ref.chapter - 1].name + ' ' + ref.chapter + ':' + ref.verse;
  const pageStart = verse => Math.floor((verse - 1) / pageSize) * pageSize + 1;

  function renderLanguageStatus() {
    for (const [prefix, requested] of [['daily', dailyLanguage.value === 'ur'], ['quran', displayModes[language.value].includes('ur')]]) {
      byId(prefix + '-language-status').textContent = requested ? urduMessage : '';
      byId(prefix + '-urdu-retry').hidden = !requested || !urduFailed;
    }
  }

  async function getUrdu(download = false) {
    if (urdu) return;
    if (urduLoad) {
      await urduLoad;
      if (download && !urdu && !urduFailed) return getUrdu(true);
      return;
    }
    urduLoad = (async () => {
      urduFailed = false;
      urduMessage = download ? 'Getting Urdu translation…' : '';
      renderLanguageStatus();
      const cache = await window.caches?.open(urduCache).catch(() => null);
      try {
        let response = await cache?.match(urduEndpoint);
        let savedOffline = Boolean(response);
        if (!response && download) {
          response = await fetch(urduEndpoint, { method: 'POST' });
          if (!response.ok) {
            const failure = await response.json();
            throw new Error(failure.error || 'Urdu download unavailable.');
          }
        }
        if (!response) return;
        const edition = await response.clone().json();
        if (!edition.version || !edition.transcript || edition.verses?.length !== data.chapters.at(-1).ayahs.at(-1)[0]) {
          await cache?.delete(urduEndpoint);
          throw new Error('The Urdu download is incomplete.');
        }
        if (!savedOffline && cache) {
          try {
            await cache.put(urduEndpoint, response);
            savedOffline = true;
          } catch {
            // Reading can continue for this session if browser storage is full.
          }
        }
        urdu = edition;
        urduMessage = savedOffline ? '' : 'Urdu is available for this session. Browser storage is unavailable.';
        byId('quran-urdu-version').textContent = '(' + urdu.version + ')';
        byId('quran-notices').textContent += '\n\n' + urdu.transcript;
        renderDailyText();
        if (selection) render(false);
      } catch (error) {
        if (!download) return;
        urduFailed = true;
        urduMessage = error instanceof TypeError
          ? 'Start Akhlaq in Termux and connect to the internet for the first Urdu download.' : error.message;
      } finally {
        renderLanguageStatus();
      }
    })();
    try {
      await urduLoad;
    } finally {
      urduLoad = undefined;
    }
  }

  function renderDailyText() {
    if (!daily) return;
    const [id, , english] = data.chapters[daily.chapter - 1].ayahs[daily.verse - 1];
    const translated = dailyLanguage.value === 'ur' && urdu;
    dailyText.lang = translated ? 'ur' : 'en';
    dailyText.dir = translated ? 'rtl' : 'ltr';
    dailyText.textContent = translated ? urdu.verses[id - 1][0] : english;
    byId('daily-credit').textContent = translated
      ? 'Urdu translation by Muhammad Ibrahim Junagarhi via QuranEnc'
      : 'English translation by Rowwad Translation Center';
  }

  function showDaily() {
    if (!data) return;
    const day = today();
    if (day === shownDay) return;
    shownDay = day;
    byId('daily-save-status').textContent = '';
    daily = dailyVerse(data.chapters, day);
    byId('daily-reference').textContent = reference(daily);
    renderDailyText();
    byId('daily-open').href = hashFor(daily);
    for (const id of ['daily-open', 'daily-listen', 'daily-save', 'daily-credit', 'daily-language-field']) byId(id).hidden = false;
    syncSaveButton(byId('daily-save'), daily);
  }

  function showSelected(focus = false) {
    for (const row of list.children) {
      const selected = Number(row.dataset.verse) === selection.verse;
      if (selected) row.setAttribute('aria-current', 'location');
      else row.removeAttribute('aria-current');
      if (selected && focus) {
        row.focus({ preventScroll: true });
        row.scrollIntoView({ block: 'nearest' });
      }
    }
    playButton.textContent = 'Play from ' + selection.chapter + ':' + selection.verse;
  }

  function render(focus) {
    const chapter = current();
    const start = pageStart(selection.verse);
    const end = Math.min(start + pageSize - 1, chapter.ayahs.length);
    select.value = String(chapter.id);
    byId('quran-chapter-name').textContent = chapter.name;
    byId('quran-chapter-info').textContent = chapter.meaning + ' · ' + chapter.ayahs.length + ' verses';
    byId('quran-page-label').textContent = start + '–' + end + ' of ' + chapter.ayahs.length;
    byId('quran-previous').disabled = chapter.id === 1 && start === 1;
    byId('quran-next').disabled = chapter.id === data.chapters.length && end === chapter.ayahs.length;
    const shown = displayModes[language.value].filter(lang => lang !== 'ur' || urdu);
    if (!shown.length) shown.push('ar');
    const basmala = byId('quran-basmala');
    basmala.hidden = !shown.includes('ar') || start !== 1 || [1, 9].includes(chapter.id);
    list.start = start;
    list.replaceChildren(...chapter.ayahs.slice(start - 1, end).map(([id, arabic, english, notes], index) => {
      const verse = start + index;
      const row = document.createElement('li');
      row.className = 'ayah';
      row.tabIndex = -1;
      row.dataset.verse = String(verse);

      const actions = document.createElement('div');
      actions.className = 'ayah-actions';
      const ref = { chapter: chapter.id, verse };
      const label = make('button', chapter.id + ':' + verse);
      label.type = 'button';
      label.className = 'ayah-reference';
      label.setAttribute('aria-label', 'Set reading place at ' + chapter.id + ':' + verse);
      label.addEventListener('click', () => selectVerse(ref));
      const listen = make('button', 'Listen');
      listen.type = 'button';
      listen.setAttribute('aria-label', 'Listen to verse ' + chapter.id + ':' + verse);
      listen.addEventListener('click', () => play({ chapter: chapter.id, verse }, voiceSelect.value));
      const bookmark = make('button', 'Save verse');
      bookmark.type = 'button';
      bookmark.dataset.bookmark = String(verse);
      bookmark.addEventListener('click', () => toggleBookmark(ref));
      actions.append(label, listen, bookmark);

      row.append(actions);
      const appendText = (lang, text, footnotes) => {
        const paragraph = make('p', text);
        paragraph.lang = lang;
        paragraph.dir = lang === 'en' ? 'ltr' : 'rtl';
        paragraph.className = 'ayah-' + { ar: 'arabic', en: 'english', ur: 'urdu' }[lang];
        row.append(paragraph);
        if (footnotes) {
          const detail = document.createElement('details');
          detail.className = 'ayah-notes';
          const note = make('p', footnotes);
          note.lang = lang;
          note.dir = paragraph.dir;
          detail.append(make('summary', lang === 'ur' ? 'Urdu translation notes' : 'English translation notes'), note);
          row.append(detail);
        }
      };
      if (shown.includes('ar')) appendText('ar', arabic);
      if (shown.includes('en')) appendText('en', english, notes);
      if (shown.includes('ur')) appendText('ur', ...urdu.verses[id - 1]);
      return row;
    }));
    updateSaveButtons();
    showSelected(focus);
  }

  const keyFor = ref => ref.chapter + ':' + ref.verse;

  function syncSaveButton(button, ref) {
    const selected = bookmarks.has(keyFor(ref));
    button.textContent = selected ? 'Saved ✓' : 'Save verse';
    button.setAttribute('aria-label', 'Save verse ' + keyFor(ref));
    button.setAttribute('aria-pressed', String(selected));
  }

  function updateSaveButtons() {
    if (daily) syncSaveButton(byId('daily-save'), daily);
    for (const button of list.querySelectorAll('[data-bookmark]')) {
      syncSaveButton(button, { chapter: selection.chapter, verse: Number(button.dataset.bookmark) });
    }
  }

  function renderBookmarks() {
    byId('quran-saved-title').textContent = 'Saved verses · ' + bookmarks.size;
    byId('quran-saved-empty').hidden = bookmarks.size > 0;
    const rows = [...bookmarks.values()].reverse().map(ref => {
      const item = document.createElement('li');
      const button = make('button', reference(ref));
      button.type = 'button';
      button.addEventListener('click', () => selectVerse(ref, { focus: true }));
      item.append(button);
      return item;
    });
    byId('quran-saved-list').replaceChildren(...rows);
    updateSaveButtons();
  }

  function toggleBookmark(ref) {
    const key = keyFor(ref);
    const added = !bookmarks.has(key);
    if (added) bookmarks.set(key, ref);
    else bookmarks.delete(key);
    const success = remember({ bookmarks: [...bookmarks.values()] });
    const status = byId(route === 'quran' ? 'quran-save-status' : 'daily-save-status');
    status.textContent = success ? (added ? 'Verse saved.' : 'Verse removed.')
      : 'Could not save to this device. The change is available for this session.';
    renderBookmarks();
  }

  function renderResume() {
    const last = saved.last && verseReference(keyFor(saved.last), data.chapters);
    byId('home-reading').hidden = route !== 'home' || !last;
    if (!last) return;
    byId('home-reading-reference').textContent = reference(last);
    byId('home-resume').href = hashFor(last);
  }

  function selectVerse(ref, { focus = false, updateUrl = true } = {}) {
    const rerender = !selection || ref.chapter !== selection.chapter || pageStart(ref.verse) !== pageStart(selection.verse);
    selection = ref;
    remember({ last: ref });
    renderResume();
    if (updateUrl && route === 'quran') {
      target = ref.chapter + ':' + ref.verse;
      history.replaceState(null, '', hashFor(ref));
    }
    if (rerender) render(focus);
    else showSelected(focus);
  }

  function clearAudio() {
    if (!playing) return;
    playing = null;
    audioAttempt++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    player.hidden = true;
    document.body.classList.remove('audio-open');
    playerToggle.textContent = 'Play';
    playerMode.value = voiceSelect.value;
    audioStatus.textContent = '';
  }

  function openRoute() {
    if (!data || route !== 'quran') return;
    const ref = verseReference(target, data.chapters)
      || verseReference(saved.last ? saved.last.chapter + ':' + saved.last.verse : '', data.chapters)
      || { chapter: 1, verse: 1 };
    selectVerse(ref, { focus: Boolean(target), updateUrl: false });
  }

  function showAudioFailure(action, message) {
    const language = playing.part === 'arabic' ? 'Arabic' : 'English';
    playerToggle.textContent = action + ' ' + language;
    audioStatus.textContent = partLabel(playing) + ' · ' + message;
  }

  function requestPlay(attempt) {
    audio.play().catch(error => {
      if (attempt !== audioAttempt || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        showAudioFailure('Play', 'Tap to continue playback.');
      } else {
        showAudioFailure('Retry', 'Recording unavailable. Check your connection.');
      }
    });
  }

  function loadAudioPart(part, start = true) {
    playing.part = part;
    playing.finished = false;
    const attempt = ++audioAttempt;
    const track = data.chapters[playing.chapter - 1].ayahs[playing.verse - 1];
    audioStatus.textContent = start ? 'Loading · ' + partLabel(playing) : partLabel(playing);
    audio.src = audioUrl(part, playing.chapter, playing.verse, track[0]);
    playerToggle.textContent = start ? 'Pause' : 'Play';
    if (start) requestPlay(attempt);
  }

  function partLabel({ mode, part }) {
    if (mode === 'both') return part === 'arabic' ? '1 of 2 · Arabic recitation' : '2 of 2 · English translation';
    return part === 'arabic' ? 'Arabic recitation' : 'English translation';
  }

  function play(ref, mode, { follow = route === 'quran', focus = false, singleVerse = false, start = true } = {}) {
    if (follow) selectVerse(ref, { focus });
    const chapter = data.chapters[ref.chapter - 1];
    playing = { chapter: ref.chapter, verse: ref.verse, mode, singleVerse };
    playerMode.value = mode;
    const verseLink = byId('playing-verse');
    verseLink.textContent = reference(ref);
    verseLink.href = hashFor(ref);
    playerNext.disabled = ref.verse >= chapter.ayahs.length;
    player.hidden = false;
    document.body.classList.add('audio-open');
    loadAudioPart(mode === 'english' ? 'english' : 'arabic', start);
  }

  function nextAudioVerse() {
    if (!playing || playerNext.disabled) return;
    const follow = route === 'quran' && selection && keyFor(selection) === keyFor(playing);
    play({ chapter: playing.chapter, verse: playing.verse + 1 }, playing.mode, { follow, focus: follow, singleVerse: playing.singleVerse });
  }

  function changeAudioMode(mode) {
    voiceSelect.value = playerMode.value = mode;
    remember({ audioMode: mode });
    if (playing && playing.mode !== mode) {
      play(playing, mode, { follow: false, singleVerse: playing.singleVerse, start: !audio.paused && !playing.finished });
    }
  }

  playerNext.addEventListener('click', nextAudioVerse);
  playerMode.addEventListener('change', () => changeAudioMode(playerMode.value));
  byId('player-close').addEventListener('click', () => {
    clearAudio();
    if (route === 'quran') playButton.focus({ preventScroll: true });
    else {
      const activeTab = document.querySelector('.tab-bar [aria-current]');
      activeTab?.focus({ preventScroll: true });
    }
  });
  playerToggle.addEventListener('click', () => {
    if (!playing) return;
    if (playing.finished) {
      loadAudioPart(playing.mode === 'english' ? 'english' : 'arabic');
    } else if (audio.error) {
      loadAudioPart(playing.part);
    } else if (audio.paused) {
      requestPlay(audioAttempt);
    } else {
      audio.pause();
    }
  });
  audio.addEventListener('play', () => { playerToggle.textContent = 'Pause'; });
  audio.addEventListener('pause', () => {
    if (playing && !audio.error && !audio.ended) playerToggle.textContent = 'Play';
  });
  audio.addEventListener('playing', () => {
    if (playing) audioStatus.textContent = partLabel(playing);
  });
  audio.addEventListener('error', () => {
    if (!playing) return;
    showAudioFailure('Retry', 'Recording unavailable. Check your connection.');
  });
  audio.addEventListener('ended', () => {
    if (!playing) return;
    const next = nextAudioPart(playing.mode, playing.part,
      !playing.singleVerse && byId('quran-autoplay').checked, !playerNext.disabled);
    if (next === 'english') loadAudioPart(next);
    else if (next === 'next-verse') nextAudioVerse();
    else {
      playing.finished = true;
      playerToggle.textContent = 'Replay';
      audioStatus.textContent = 'Finished ' + reference(playing) + '.';
    }
  });

  function load() {
    if (loading) return;
    status.textContent = 'Loading the Quran…';
    loading = (async () => {
      try {
        const response = await fetch('/quran.json');
        if (!response.ok) throw new Error('Quran data unavailable');
        data = await response.json();
      } catch {
        dailyText.textContent = 'The Quran is unavailable. Start Akhlaq in Termux and reopen the app.';
        status.textContent = dailyText.textContent;
        loading = undefined;
        return;
      }
      bookmarks = readingBookmarks(saved, data.chapters);
      select.replaceChildren(...data.chapters.map(chapter => new Option(chapter.id + '. ' + chapter.name + ' · ' + chapter.meaning, chapter.id)));
      byId('quran-version').textContent = '(' + data.englishVersion + ')';
      byId('quran-notices').textContent = data.englishTranscript + '\n\n' + data.arabicNotice;
      byId('quran-basmala').textContent = data.chapters[0].ayahs[0][1];
      status.textContent = '';
      byId('quran-tools').hidden = false;
      showDaily();
      renderBookmarks();
      renderResume();
      openRoute();
      void getUrdu(dailyLanguage.value === 'ur' || displayModes[language.value].includes('ur'));
    })();
  }

  byId('daily-listen').addEventListener('click', () => {
    if (daily) play(daily, voiceSelect.value, { follow: false, singleVerse: true });
  });
  byId('daily-save').addEventListener('click', () => toggleBookmark(daily));
  window.addEventListener('storage', event => {
    if (!data || (event.key !== readerKey && event.key !== null)) return;
    saved = stored(readerKey);
    bookmarks = readingBookmarks(saved, data.chapters);
    renderBookmarks();
    renderResume();
    voiceSelect.value = savedAudioMode(saved);
    if (!playing) playerMode.value = voiceSelect.value;
  });
  playButton.addEventListener('click', () => play(selection, voiceSelect.value));
  voiceSelect.addEventListener('change', () => changeAudioMode(voiceSelect.value));
  function setReadingLanguage(mode) {
    language.value = mode;
    remember({ language: mode });
    if (selection) render(false);
    renderLanguageStatus();
    if (displayModes[mode].includes('ur')) void getUrdu(true);
  }

  language.addEventListener('change', () => setReadingLanguage(language.value));
  dailyLanguage.addEventListener('change', () => {
    remember({ dailyLanguage: dailyLanguage.value });
    renderDailyText();
    renderLanguageStatus();
    if (dailyLanguage.value === 'ur') void getUrdu(true);
  });
  for (const id of ['daily-urdu-retry', 'quran-urdu-retry']) {
    byId(id).addEventListener('click', () => void getUrdu(true));
  }
  size.addEventListener('change', () => {
    byId('quran').dataset.size = size.value;
    remember({ size: size.value });
  });
  byId('quran-autoplay').addEventListener('change', event => remember({ autoplay: event.target.checked }));
  select.addEventListener('change', () => {
    results.hidden = true;
    selectVerse({ chapter: Number(select.value), verse: 1 });
  });
  byId('quran-previous').addEventListener('click', () => {
    const start = pageStart(selection.verse);
    if (start > 1) selectVerse({ chapter: selection.chapter, verse: start - pageSize }, { focus: true });
    else {
      const chapter = data.chapters[selection.chapter - 2];
      selectVerse({ chapter: chapter.id, verse: pageStart(chapter.ayahs.length) }, { focus: true });
    }
  });
  byId('quran-next').addEventListener('click', () => {
    const next = pageStart(selection.verse) + pageSize;
    selectVerse(next <= current().ayahs.length ? { chapter: selection.chapter, verse: next }
      : { chapter: selection.chapter + 1, verse: 1 }, { focus: true });
  });
  byId('quran-search').addEventListener('submit', event => {
    event.preventDefault();
    const query = byId('quran-query').value.trim();
    results.replaceChildren();
    results.hidden = !query;
    if (!query) return;
    const direct = verseReference(query, data.chapters);
    if (direct) {
      results.hidden = true;
      selectVerse(direct, { focus: true });
      return;
    }
    const verseQuery = /^\d+\s*:/.test(westernDigits(query));
    if (verseQuery || searchText(query).length < 2) {
      results.append(make('p', verseQuery ? 'No verse at that reference.' : 'Enter at least two characters.'));
      return;
    }
    const hits = findVerses(data.chapters, query, urdu);
    if (!urdu && /\p{Script=Arabic}/u.test(query)) {
      results.append(make('p', 'Select an Urdu option under Show text to download Urdu and include it in search.'));
    }
    results.append(make('p', hits.length > 15 ? 'First 15 matches' : hits.length ? hits.length + (hits.length === 1 ? ' match' : ' matches') : 'No matching verses.'));
    for (const { chapter, verse, lang, text } of hits.slice(0, 15)) {
      const button = make('button', '');
      button.type = 'button';
      const excerpt = make('span', text);
      excerpt.lang = lang;
      excerpt.dir = lang === 'en' ? 'ltr' : 'rtl';
      button.append(make('strong', reference({ chapter, verse })), excerpt);
      button.addEventListener('click', () => {
        results.hidden = true;
        if (!displayModes[language.value].includes(lang)) {
          setReadingLanguage({ ar: 'arabic', ur: 'arabic-urdu', en: 'both' }[lang]);
        }
        selectVerse({ chapter, verse }, { focus: true });
      });
      results.append(button);
    }
  });

  return {
    navigate(page, suffix) {
      if (route === page && target === suffix) return;
      byId('quran-save-status').textContent = '';
      byId('daily-save-status').textContent = '';
      route = page;
      target = suffix;
      if (data) {
        renderResume();
        openRoute();
      } else if (route === 'home' || route === 'quran') load();
    },
    showDaily,
  };
}
