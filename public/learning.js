import { narrate } from './companion.js';
const get = id => document.getElementById(id);
export function dailyIndex(day, length) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(length) || length < 1) return 0;
  let hash = 0;
  for (const character of day) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % length;
}
export function normaliseSearch(value) {
  return String(value).normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)))
    .toLocaleLowerCase().trim();
}
export function cleanLearningPreferences(value, hadiths, practices) {
  return {
    language: value?.language === 'ur' ? 'ur' : 'en',
    saved: [...new Set(Array.isArray(value?.saved) ? value.saved : [])].filter(id => hadiths.some(h => h.id === id)),
    routine: practices.some(p => p.id === value?.routine) ? value.routine : '',
  };
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function link(text, href, external = false) {
  const element = node('a', text, 'small-button');
  element.href = href;
  if (external) { element.target = '_blank'; element.rel = 'noopener noreferrer'; }
  return element;
}
function disclosure(title, text, language) {
  const details = node('details');
  const body = node('p', text, 'source-text');
  if (language) { body.lang = language; body.dir = language === 'en' ? 'ltr' : 'rtl'; }
  details.append(node('summary', title), body);
  return details;
}

export function setupLearning({ stored, save, today }) {
  const key = 'akhlaq.learning.preferences.v1';
  let collection, content, preferences, loading;
  let section = 'hadith', selected = '', lastRoute = '';
  const language = get('hadith-language');
  const query = get('learn-query');
  const topic = get('learn-topic');
  const savedOnly = get('learn-saved-only');
  function remember(next) {
    if (!save(key, next)) {
      get('learn-status').textContent = 'Your device could not save this change. Free some storage and try again.';
      return false;
    }
    preferences = next;
    get('learn-status').textContent = 'Saved on this device.';
    return true;
  }
  async function load() {
    if (collection) return true;
    if (loading) return loading;
    loading = (async () => {
      try {
        const responses = await Promise.all(['/hadith.json', '/learning-content.json'].map(url => fetch(url)));
        if (responses.some(response => !response.ok)) throw new Error('Unavailable content');
        [collection, content] = await Promise.all(responses.map(response => response.json()));
        preferences = cleanLearningPreferences(stored(key), collection.hadiths, content.practices);
        language.value = preferences.language;
        for (const label of new Set(collection.hadiths.map(h => h.topic))) topic.add(new Option(label, label));
        get('learning-notice').textContent = content.editorialNotice;
        get('learning-editions').textContent = Object.entries(collection.editions)
          .map(([lang, edition]) => (lang === 'en' ? 'English' : 'Urdu') + ' ' + edition.version + '\n' + edition.transcript).join('\n\n');
        get('learning-checked').textContent = 'References checked ' + collection.checkedOn + '. ' + collection.hadiths.length + ' selected narrations; this is not the complete collection.';
        get('learn-status').textContent = '';
        get('learn-retry').hidden = true;
        return true;
      } catch {
        collection = null;
        get('learn-status').textContent = 'Learning content could not load. Try again, or reopen the app.';
        get('daily-hadith-text').textContent = 'Learning content could not load. Open Learn to retry.';
        get('learn-retry').hidden = false;
        return false;
      } finally { loading = null; }
    })();
    return loading;
  }
  function sourceDetails(hadith) {
    const record = hadith.translations[preferences.language];
    const box = node('div', undefined, 'hadith-body');
    const body = node('p', record.hadith_text, 'source-text hadith-translation');
    body.lang = preferences.language;
    body.dir = preferences.language === 'ur' ? 'rtl' : 'ltr';
    box.append(body, disclosure('Arabic text', record.hadith_text_ar, 'ar'));
    const explanation = disclosure('Publisher explanation', record.explanation, preferences.language);
    explanation.append(node('h4', 'Publisher benefits'));
    const benefits = node('p', record.benefits, 'source-text');
    benefits.lang = preferences.language; benefits.dir = preferences.language === 'ur' ? 'rtl' : 'ltr';
    explanation.append(benefits);
    explanation.append(disclosure('Arabic explanation', record.explanation_ar, 'ar'), disclosure('Arabic benefits', record.benefits_ar, 'ar'));
    box.append(explanation);
    const refs = node('div', undefined, 'reader-actions');
    refs.append(link('Publisher source ↗', record.link, true), link('Bukhari ' + hadith.bukhari + ' ↗', hadith.bukhariUrl, true));
    box.append(refs, node('p', 'HadeethEnc · ' + collection.editions[preferences.language].version + ' · Publisher grade: ' + record.grade + ' · ' + record.takhrij, 'muted'));
    box.append(node('p', 'Bukhari reference cross-checked. HadeethEnc wording can include parallel narrations; the publisher text is preserved.', 'muted'));
    return box;
  }
  function renderHadiths(preserveOpen = false) {
    const opened = new Set(preserveOpen ? [...get('hadith-list').querySelectorAll('article > details[open]')].map(d => d.id) : []);
    const needle = normaliseSearch(query.value);
    const visible = collection.hadiths.filter(h => (!topic.value || h.topic === topic.value)
      && (!savedOnly.checked || preferences.saved.includes(h.id))
      && (!needle || normaliseSearch([h.label, h.bukhari, ...Object.values(h.translations).flatMap(t => [t.title, t.hadith_text, t.hadith_text_ar])].join(' ')).includes(needle)));
    get('learn-count').textContent = visible.length + ' of ' + collection.hadiths.length + ' hadiths';
    get('learn-empty').hidden = visible.length !== 0;
    get('hadith-list').replaceChildren(...visible.map(h => {
      const card = node('article', undefined, 'learning-card');
      const detail = node('details'); detail.id = 'hadith-' + h.id; detail.open = selected === h.id || opened.has(detail.id);
      const summary = node('summary');
      summary.append(node('span', h.label), node('span', 'Bukhari ' + h.bukhari + ' · ' + h.topic, 'muted'));
      detail.append(summary, sourceDetails(h));
      const button = node('button', preferences.saved.includes(h.id) ? 'Saved · remove' : 'Save hadith');
      button.type = 'button'; button.dataset.saveHadith = h.id;
      button.setAttribute('aria-pressed', String(preferences.saved.includes(h.id)));
      button.addEventListener('click', () => {
        const saved = preferences.saved.includes(h.id) ? preferences.saved.filter(id => id !== h.id) : [...preferences.saved, h.id];
        if (remember({ ...preferences, saved })) {
          if (savedOnly.checked) {
            renderHadiths(true);
            (get('hadith-list').querySelector('button') || get('learn-clear')).focus();
          }
          else { button.textContent = saved.includes(h.id) ? 'Saved · remove' : 'Save hadith'; button.setAttribute('aria-pressed', String(saved.includes(h.id))); }
        }
      });
      card.append(detail, button);
      return card;
    }));
  }
  function renderPractices() {
    get('practice-ideas').replaceChildren(...content.practices.map(p => {
      const card = node('article', undefined, 'learning-card');
      card.append(node('h3', p.title), node('p', p.cue, 'eyebrow'), node('p', p.action));
      const actions = node('div', undefined, 'reader-actions');
      const choose = node('button', preferences.routine === p.id ? 'Your routine' : 'Choose this routine');
      choose.type = 'button'; choose.dataset.routine = p.id; choose.setAttribute('aria-pressed', String(preferences.routine === p.id));
      choose.addEventListener('click', () => {
        if (remember({ ...preferences, routine: preferences.routine === p.id ? '' : p.id })) {
          renderPractices(); refreshDaily();
          get('practice-ideas').querySelector('[data-routine="' + p.id + '"]')?.focus();
        }
      });
      actions.append(link('Read the evidence', '#learn/hadith/' + p.hadith), choose);
      card.append(actions);
      return card;
    }));
  }
  function renderStories() {
    get('prophet-stories').replaceChildren(...content.stories.map(story => {
      const detail = node('details', undefined, 'learning-card'); detail.id = 'story-' + story.id;
      detail.open = selected === story.id;
      const summary = node('summary'); summary.append(node('span', story.name), node('span', story.title, 'muted'));
      detail.append(summary, node('p', 'Quran-based summary · English', 'eyebrow'));
      for (const part of story.parts) {
        detail.append(node('p', part.text));
        const citations = node('div', undefined, 'reader-actions');
        for (const ref of part.references) citations.append(link('Read Quran ' + ref.chapter + ':' + ref.from + '–' + ref.to, '#quran/' + ref.chapter + ':' + ref.from));
        detail.append(citations);
      }
      detail.append(node('p', 'Personal reflection: ' + story.reflection, 'reflection-prompt'));
      const listen = node('button', 'Listen to this story'); listen.type = 'button'; listen.addEventListener('click', () => narrate(story.name + ': ' + story.title, story.parts.map(p => p.text).join('\n\n'), 'story-' + story.id)); detail.append(listen, link('Write a reflection', '#practice'));
      return detail;
    }));
  }
  function render() {
    for (const name of ['hadith', 'practices', 'stories']) {
      get('learn-' + name).hidden = section !== name;
      const anchor = document.querySelector('[data-learn="' + name + '"]');
      if (section === name) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current');
    }
    renderHadiths(); renderPractices(); renderStories();
    if (selected) {
      const item = get((section === 'stories' ? 'story-' : 'hadith-') + selected);
      if (item) item.scrollIntoView({ block: 'start' });
    }
  }
  async function refreshDaily() {
    if (!await load()) return;
    const hadith = collection.hadiths[dailyIndex(today(), collection.hadiths.length)];
    const record = hadith.translations[preferences.language];
    const text = get('daily-hadith-text'); text.textContent = record.hadith_text;
    text.lang = preferences.language; text.dir = preferences.language === 'ur' ? 'rtl' : 'ltr';
    get('daily-hadith-reference').textContent = 'Bukhari ' + hadith.bukhari + ' · HadeethEnc ' + collection.editions[preferences.language].version;
    get('daily-hadith-open').href = '#learn/hadith/' + hadith.id;
    const practice = content.practices.find(p => p.id === preferences.routine) || content.practices[dailyIndex(today(), content.practices.length)];
    get('daily-practice-label').textContent = preferences.routine ? 'Your chosen routine' : 'One small practice to try';
    get('daily-practice-title').textContent = practice.title;
    get('daily-practice-cue').textContent = practice.cue;
    get('daily-practice-action').textContent = practice.action;
    get('daily-practice-open').href = practice.route; get('daily-practice-open').textContent = practice.button;
    get('daily-practice-evidence').href = '#learn/hadith/' + practice.hadith;
  }
  async function navigate(page) {
    if (page !== 'learn' || !await load()) return;
    if (location.hash.slice(1).split('/')[0] !== 'learn') return;
    const [, requested, id = ''] = location.hash.slice(1).split('/');
    section = ['hadith', 'practices', 'stories'].includes(requested) ? requested : 'hadith';
    selected = id;
    if (selected) { query.value = ''; topic.value = ''; savedOnly.checked = false; }
    render();
    if (lastRoute !== location.hash) {
      const target = selected ? get((section === 'stories' ? 'story-' : 'hadith-') + selected)?.querySelector('summary') : get('learn-' + section).querySelector('h2');
      if (target) {
        if (target.tagName !== 'SUMMARY') target.tabIndex = -1;
        target.focus({ preventScroll: true });
        if (lastRoute || selected) target.scrollIntoView({ block: 'start' });
      }
      lastRoute = location.hash;
    }
  }
  language.addEventListener('change', () => {
    if (!collection) return;
    if (remember({ ...preferences, language: language.value })) { renderHadiths(true); refreshDaily(); }
    else language.value = preferences.language;
  });
  for (const control of [query, topic, savedOnly]) control.addEventListener(control === query ? 'input' : 'change', () => { if (collection) { selected = ''; renderHadiths(); } });
  get('learn-clear').addEventListener('click', () => { query.value = ''; topic.value = ''; savedOnly.checked = false; if (collection) renderHadiths(); query.focus(); });
  get('learn-retry').addEventListener('click', async () => { await refreshDaily(); navigate('learn'); });
  return { refreshDaily, navigate };
}
