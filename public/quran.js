const pageSize = 15;
const readerKey = 'akhlaq.reader.v1';
const audioMessage = 'Audio streams over the internet.';
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

export function verseReference(value, chapters) {
  const match = /^(\d{1,3})\s*:\s*(\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  return verse >= 1 && verse <= (chapters[chapter - 1]?.ayahs.length || 0) ? { chapter, verse } : null;
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

export function setupQuran({ stored, save, today }) {
  const status = byId('quran-status');
  const dailyText = byId('daily-text');
  const select = byId('quran-chapter');
  const audio = byId('quran-audio');
  const voiceSelect = byId('quran-voice');
  const language = byId('quran-language');
  const audioStatus = byId('quran-audio-status');
  const results = byId('quran-results');
  const list = byId('quran-verses');
  const playButton = byId('quran-play');
  let data;
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
  let pendingDailyListen = false;

  voiceSelect.value = saved.voice === 'arabic' ? 'arabic' : 'english';
  language.value = ['arabic', 'english'].includes(saved.language) ? saved.language : 'both';
  byId('quran-autoplay').checked = saved.autoplay !== false;
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

  function showDaily() {
    if (!data) return;
    const day = today();
    if (day === shownDay) return;
    shownDay = day;
    byId('daily-save-status').textContent = '';
    daily = dailyVerse(data.chapters, day);
    byId('daily-reference').textContent = reference(daily);
    dailyText.textContent = data.chapters[daily.chapter - 1].ayahs[daily.verse - 1][2];
    byId('daily-open').href = hashFor(daily);
    for (const id of ['daily-open', 'daily-listen', 'daily-save', 'daily-credit']) byId(id).hidden = false;
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
    byId('quran').dataset.language = language.value;
    const basmala = byId('quran-basmala');
    basmala.hidden = start !== 1 || [1, 9].includes(chapter.id);
    list.start = start;
    list.replaceChildren(...chapter.ayahs.slice(start - 1, end).map(([, arabic, english, notes], index) => {
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

      const original = make('p', arabic);
      Object.assign(original, { className: 'ayah-arabic', lang: 'ar', dir: 'rtl' });
      const translation = make('p', english);
      translation.className = 'ayah-english';
      row.append(actions, original, translation);
      if (notes) {
        const detail = document.createElement('details');
        detail.className = 'ayah-notes';
        detail.append(make('summary', 'Translation notes'), make('p', notes));
        row.append(detail);
      }
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
    audio.hidden = true;
    audioStatus.textContent = audioMessage;
  }

  function openRoute() {
    if (!data || route !== 'quran') return;
    const ref = verseReference(target, data.chapters)
      || verseReference(saved.last ? saved.last.chapter + ':' + saved.last.verse : '', data.chapters)
      || { chapter: 1, verse: 1 };
    selectVerse(ref, { focus: Boolean(target) && !pendingDailyListen, updateUrl: false });
  }

  function play(ref, voice, advancing = false, singleVerse = false) {
    if (route !== 'quran') return;
    selectVerse(ref, { focus: advancing });
    const track = current().ayahs[ref.verse - 1];
    const attempt = ++audioAttempt;
    playing = { ...ref, voice, singleVerse };
    audio.hidden = false;
    audio.src = audioUrl(voice, ref.chapter, ref.verse, track[0]);
    audioStatus.textContent = 'Loading ' + reference(ref) + '…';
    audio.play().catch(error => {
      if (attempt !== audioAttempt || error.name === 'AbortError') return;
      audioStatus.textContent = error.name === 'NotAllowedError'
        ? 'Tap play on the audio controls to continue.' : 'Audio unavailable. Check your internet connection and try again.';
    });
  }

  audio.addEventListener('playing', () => {
    if (playing) audioStatus.textContent = reference(playing) + (playing.voice === 'arabic' ? ' · Arabic recitation' : ' · English translation');
  });
  audio.addEventListener('error', () => {
    if (playing) audioStatus.textContent = 'Audio unavailable. Check your internet connection and try again.';
  });
  audio.addEventListener('ended', () => {
    if (!playing) return;
    const chapter = data.chapters[playing.chapter - 1];
    if (!playing.singleVerse && byId('quran-autoplay').checked && playing.verse < chapter.ayahs.length) {
      play({ chapter: playing.chapter, verse: playing.verse + 1 }, playing.voice, true);
    } else audioStatus.textContent = 'Finished ' + reference(playing) + '.';
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
    })();
  }

  byId('daily-listen').addEventListener('click', () => {
    if (!daily) return;
    // Prepare the reader synchronously so playback keeps the tap's user activation.
    pendingDailyListen = true;
    location.hash = hashFor(daily);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    voiceSelect.value = 'english';
    remember({ voice: 'english' });
    play(daily, 'english', false, true);
    pendingDailyListen = false;
  });
  byId('daily-save').addEventListener('click', () => toggleBookmark(daily));
  window.addEventListener('storage', event => {
    if (!data || (event.key !== readerKey && event.key !== null)) return;
    saved = stored(readerKey);
    bookmarks = readingBookmarks(saved, data.chapters);
    renderBookmarks();
    renderResume();
  });
  playButton.addEventListener('click', () => play(selection, voiceSelect.value));
  voiceSelect.addEventListener('change', () => {
    clearAudio();
    remember({ voice: voiceSelect.value });
  });
  language.addEventListener('change', () => {
    byId('quran').dataset.language = language.value;
    remember({ language: language.value });
  });
  byId('quran-autoplay').addEventListener('change', event => remember({ autoplay: event.target.checked }));
  select.addEventListener('change', () => {
    clearAudio();
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
    if (/^\d+\s*:/.test(query) || query.length < 2) {
      results.append(make('p', /^\d+\s*:/.test(query) ? 'No verse at that reference.' : 'Enter at least two characters.'));
      return;
    }
    const needle = query.toLocaleLowerCase('en-GB');
    const hits = [];
    for (const chapter of data.chapters) {
      for (const [index, [, , english]] of chapter.ayahs.entries()) {
        if (english.toLocaleLowerCase('en-GB').includes(needle)) hits.push({ chapter: chapter.id, verse: index + 1, english });
        if (hits.length > 15) break;
      }
      if (hits.length > 15) break;
    }
    results.append(make('p', hits.length > 15 ? 'First 15 matches' : hits.length ? hits.length + (hits.length === 1 ? ' match' : ' matches') : 'No matching verses.'));
    for (const { chapter, verse, english } of hits.slice(0, 15)) {
      const button = make('button', '');
      button.type = 'button';
      button.append(make('strong', reference({ chapter, verse })), make('span', english));
      button.addEventListener('click', () => {
        results.hidden = true;
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
      if (route !== 'quran') clearAudio();
      if (data) {
        renderResume();
        openRoute();
      } else if (route === 'home' || route === 'quran') load();
    },
    showDaily,
  };
}
