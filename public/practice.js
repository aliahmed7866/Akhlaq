import { downloadFile } from './calendar.js';

const prefix = 'akhlaq.practice.v1.';
const counters = ['subhanallah', 'alhamdulillah', 'allahu-akbar', 'astaghfirullah'];
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const prompts = [
  'What is one small deed you can do consistently this week?',
  'Who could you help today without being asked?',
  'When did you pause before reacting today?',
  'What are you grateful for today?',
  'Who have you been meaning to check in on?',
  'What can you do to give your next prayer your full attention?',
  'What did you learn today that you can put into practice?',
];

export function setupPractice({ salah, stored, save, todayForPractice, shiftDate, dateLabel }) {
  const get = id => document.getElementById(id);
  const form = get('practice-form');
  const fields = [...salah.map(([key]) => key), 'quran', 'dhikr', 'kindness'];
  const drafts = new Map();
  const dhikrType = get('dhikr-type');
  const dhikrGoal = get('dhikr-goal');
  const backupFile = get('backup-file');
  const restoreButton = get('import-backup');
  const backupStatus = get('backup-status');
  let pendingBackup;
  let practiceDay;
  let trackToday = true;

  for (const [key, label] of salah) {
    const check = document.createElement('label');
    const input = document.createElement('input');
    Object.assign(input, { type: 'checkbox', name: key });
    check.append(input, ' ' + label);
    get('prayer-checks').append(check);
  }

  function dbEntry(day = practiceDay) {
    return stored(prefix + day);
  }

  function renderStats() {
    const today = todayForPractice();
    const rows = Array.from({ length: 7 }, (_, index) => shiftDate(today, index - 6));
    let prayersLogged = 0;
    let habitsLogged = 0;
    get('week-practice').replaceChildren(...rows.map(day => {
      const entry = dbEntry(day);
      const prayers = salah.filter(([key]) => entry[key] === true).length;
      prayersLogged += prayers;
      habitsLogged += ['quran', 'dhikr', 'kindness'].filter(key => entry[key] === true).length;
      const button = document.createElement('button');
      const count = document.createElement('strong');
      button.type = 'button';
      button.setAttribute('aria-label', dateLabel(day, true) + ', ' + prayers + ' of 5 prayers logged');
      if (day === practiceDay) button.setAttribute('aria-current', 'date');
      count.textContent = prayers + '/5';
      button.append(dateLabel(day).split(',')[0].slice(0, 3), count);
      button.addEventListener('click', () => {
        trackToday = day === todayForPractice();
        show(day);
      });
      return button;
    }));
    get('week-totals').textContent = prayersLogged + ' prayers logged · ' + habitsLogged + ' habits checked';
  }

  function renderDhikr(entry = dbEntry()) {
    const state = entry.counters?.[dhikrType.value];
    const count = state?.count ?? 0;
    const goal = state?.goal ?? 33;
    dhikrGoal.value = String(goal);
    get('dhikr-count').textContent = count;
    const progress = get('dhikr-progress');
    progress.max = goal;
    progress.value = Math.min(goal, count);
    get('dhikr-progress-text').textContent = count >= goal ? 'Target reached' : (goal - count) + ' to reach ' + goal;
    get('dhikr-minus').disabled = count === 0;
  }

  function show(day) {
    practiceDay = day;
    const entry = dbEntry();
    for (const name of fields) form.elements[name].checked = entry[name] === true;
    form.elements.reflection.value = drafts.get(day) ?? entry.reflection ?? '';
    get('practice-date').textContent = dateLabel(day, true);
    get('dhikr-date').textContent = dateLabel(day, true);
    get('reflection-prompt').textContent = prompts[new Date(day + 'T12:00:00Z').getUTCDay()];
    get('later').disabled = day >= todayForPractice();
    get('save-status').textContent = drafts.has(day) ? 'Unsaved reflection' : '';
    get('dhikr-status').textContent = '';
    renderStats();
    renderDhikr(entry);
  }

  function saveForm(includeReflection) {
    const entry = dbEntry();
    for (const name of fields) entry[name] = form.elements[name].checked;
    if (includeReflection) entry.reflection = form.elements.reflection.value;
    const success = save(prefix + practiceDay, entry);
    if (success && includeReflection) drafts.delete(practiceDay);
    get('save-status').textContent = success ? (drafts.has(practiceDay) ? 'Unsaved reflection' : 'Saved on this device')
      : 'Browser storage is unavailable.';
    if (success) renderStats();
  }

  function setCounter(change) {
    const entry = dbEntry();
    const phrase = dhikrType.value;
    entry.counters ??= {};
    const state = entry.counters[phrase] ?? { count: 0, goal: 33 };
    const newCount = Math.min(99999, Math.max(0, state.count + change));
    const goal = Number(dhikrGoal.value);
    entry.counters[phrase] = { count: newCount, goal };
    const success = save(prefix + practiceDay, entry);
    const justReached = state.count < goal && newCount >= goal;
    get('dhikr-status').textContent = success ? (justReached ? 'Target reached.' : '') : 'Browser storage is unavailable.';
    renderDhikr(success ? entry : dbEntry());
  }

  form.elements.reflection.addEventListener('input', event => {
    drafts.set(practiceDay, event.target.value);
    get('save-status').textContent = 'Unsaved reflection';
  });
  form.addEventListener('change', event => {
    if (event.target.type === 'checkbox') saveForm(false);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    saveForm(true);
  });
  get('earlier').addEventListener('click', () => {
    trackToday = false;
    show(shiftDate(practiceDay, -1));
  });
  get('later').addEventListener('click', () => {
    const day = shiftDate(practiceDay, 1);
    if (day <= todayForPractice()) {
      trackToday = day === todayForPractice();
      show(day);
    }
  });
  get('today').addEventListener('click', () => {
    trackToday = true;
    show(todayForPractice());
  });
  get('dhikr-use-today').addEventListener('click', () => get('today').click());
  dhikrType.addEventListener('change', () => {
    get('dhikr-status').textContent = '';
    renderDhikr();
  });
  dhikrGoal.addEventListener('change', () => setCounter(0));
  get('dhikr-add').addEventListener('click', () => setCounter(1));
  get('dhikr-minus').addEventListener('click', () => setCounter(-1));
  get('dhikr-reset').addEventListener('click', () => {
    if (!dbEntry().counters?.[dhikrType.value]?.count) return;
    get('dhikr-reset-dialog').showModal();
  });
  get('dhikr-confirm-reset').addEventListener('click', () => setCounter(-(dbEntry().counters?.[dhikrType.value]?.count || 0)));

  get('export-backup').addEventListener('click', () => {
    try {
      const entries = {};
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        const day = key?.slice(prefix.length);
        if (key?.startsWith(prefix) && dayPattern.test(day)) entries[day] = stored(key);
      }
      downloadFile('akhlaq-practice-' + todayForPractice() + '.json',
        JSON.stringify({ version: 1, entries }, null, 2), 'application/json');
      backupStatus.textContent = 'Practice backup downloaded.';
    } catch {
      backupStatus.textContent = 'Browser storage is unavailable.';
    }
  });

  backupFile.addEventListener('change', async () => {
    pendingBackup = undefined;
    restoreButton.disabled = true;
    const file = backupFile.files[0];
    if (!file) {
      backupStatus.textContent = '';
      return;
    }
    try {
      if (file.size > 4_000_000) throw new Error('size');
      const data = JSON.parse(await file.text());
      if (file !== backupFile.files[0]) return;
      pendingBackup = validateBackup(data, fields);
      restoreButton.disabled = !pendingBackup.length;
      backupStatus.textContent = pendingBackup.length ? pendingBackup.length + (pendingBackup.length === 1 ? ' day available to restore.' : ' days available to restore.')
        : 'This backup contains no days.';
    } catch {
      if (file === backupFile.files[0]) backupStatus.textContent = 'Choose a valid Akhlaq backup under 4 MB.';
    }
  });

  restoreButton.addEventListener('click', () => {
    if (!pendingBackup?.length) return;
    let imported = 0;
    try {
      for (const [day, entry] of pendingBackup) {
        // Keep entries already on this device, including unchecked habits or cleared reflections.
        if (localStorage.getItem(prefix + day) !== null || drafts.has(day)) continue;
        localStorage.setItem(prefix + day, JSON.stringify(entry));
        imported++;
      }
      backupStatus.textContent = imported + (imported === 1 ? ' day restored.' : ' days restored.');
      pendingBackup = undefined;
      restoreButton.disabled = true;
      backupFile.value = '';
    } catch {
      backupStatus.textContent = 'Storage stopped the restore after ' + imported + ' days. You can retry.';
    }
    show(practiceDay);
  });

  return () => {
    const today = todayForPractice();
    show(trackToday || !practiceDay || practiceDay > today ? today : practiceDay);
  };
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateBackup(data, fields) {
  if (data?.version !== 1 || !isRecord(data.entries)) throw new Error('Invalid backup');
  return Object.entries(data.entries).map(([day, entry]) => {
    const date = new Date(day + 'T12:00:00Z');
    if (!dayPattern.test(day) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== day || !isRecord(entry)) {
      throw new Error('Invalid backup entry');
    }
    const result = Object.fromEntries(fields.map(field => [field, entry[field] === true]));
    result.reflection = typeof entry.reflection === 'string' ? entry.reflection.slice(0, 2000) : '';
    result.counters = {};
    for (const phrase of counters) {
      const state = entry.counters?.[phrase];
      if (Number.isInteger(state?.count) && state.count >= 0 && state.count <= 99999 && [33, 99, 100].includes(state.goal)) {
        result.counters[phrase] = { count: state.count, goal: state.goal };
      }
    }
    return [day, result];
  });
}
