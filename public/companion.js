const $ = id => document.getElementById(id);
const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
const shift = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export function hijriDay(day, offset = 0) {
  const date = new Date(shift(day, Math.max(-2, Math.min(2, Number(offset) || 0))) + 'T12:00:00Z');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-u-ca-islamic-civil', { timeZone:'UTC', year:'numeric', month:'numeric', day:'numeric' }).formatToParts(date).map(p => [p.type,p.value]));
  return { year:Number(parts.year), month:Number(parts.month), day:Number(parts.day) };
}
export function eventsFor(day, events, offset = 0) { const h = hijriDay(day, offset); return events.filter(e => h.month === e.month && h.day >= e.from && h.day <= e.to); }
export function alertEvents(days, selected, lead, now = Date.now()) {
  const valid = new Set(['fajr','dhuhr','asr','maghrib','isha']); const results = [];
  for (const day of days) for (const prayer of new Set(selected.filter(p => valid.has(p)))) {
    const at = Date.parse(day.times[prayer]); if (!Number.isFinite(at)) continue;
    if (at > now) results.push({ at, title:prayer[0].toUpperCase()+prayer.slice(1), early:false });
    if ([5,10,15].includes(lead) && at-lead*60000 > now) results.push({ at:at-lead*60000, title:prayer[0].toUpperCase()+prayer.slice(1)+' in '+lead+' minutes', early:true });
  }
  return results.sort((a,b) => a.at-b.at);
}
function source(href, label) { const a = el('a', label || (href.startsWith('#') ? 'Read Quran '+href.split('/')[1] : 'Read source ↗')); a.href=href; a.className='small-button'; if(!href.startsWith('#')) {a.target='_blank';a.rel='noopener noreferrer';} return a; }
export function narrate(title, text, id) {
  $('story-reader').hidden=false; $('story-reader-title').textContent=title;
  const status=$('story-reader-status');
  if(window.AkhlaqNative?.narrate) { window.AkhlaqNative.narrate(JSON.stringify({action:'play',id,title,text})); status.textContent='Starting device narration…'; }
  else if ('speechSynthesis' in window) {
    window.dispatchEvent(new Event('akhlaq-narration-start'));
    speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='en-GB';
    const voice=speechSynthesis.getVoices().find(v=>v.localService && v.lang.startsWith('en'));
    if(!voice) { status.textContent='An offline English voice is unavailable. Install one in device speech settings.'; return; }
    u.voice=voice; u.onend=()=>status.textContent='Finished'; u.onerror=()=>status.textContent='Narration stopped or unavailable.'; speechSynthesis.speak(u); status.textContent='Reading aloud · English';
  } else status.textContent='Device narration is unavailable.';
}
export function setupCompanion({stored,save,today,getSettings,calculate}) {
  let data, loading, schedule, lastAlerts=''; let selectedDay=today();
  let calendar=stored('akhlaq.calendar.v1');
  let prefs={mode:'off',lead:0,prayers:['fajr','dhuhr','asr','maghrib','isha'],...stored('akhlaq.alerts.v1')};
  if(!['off','gentle','adhan'].includes(prefs.mode))prefs.mode='off';
  if(!Array.isArray(prefs.prayers))prefs.prayers=[];
  async function load() { if(data)return data; if(!loading)loading=fetch('/devotional.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>data=d).finally(()=>loading=null);return loading; }
  function message(t){$('companion-status').textContent=t;}
  function hlabel(day){const h=hijriDay(day,calendar.offset);const months=['Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Ula','Jumada al-Thani','Rajab','Shaban','Ramadan','Shawwal','Dhul Qadah','Dhul Hijjah'];return `${h.day} ${months[h.month-1]} ${h.year} AH · calculated estimate`;}
  function eventCard(e){const card=el('article');card.className='learning-card'; card.append(el('h3',e.title),el('p',e.text));const actions=el('div');actions.className='reader-actions';e.refs.forEach(r=>actions.append(source(r)));const listen=el('button','Listen to this reading');listen.onclick=()=>narrate(e.title,e.text,'event-'+e.id);actions.append(listen); if(e.story)actions.append(source('#learn/stories/'+e.story,'Read the Prophet story'));card.append(actions);return card;}
  async function navigate(page) {
    if(page!=='essentials')return;
    try {await load(); if(!location.hash.startsWith('#essentials'))return; } catch {message('Could not load. Reopen this page to retry.');return;}
    const section=location.hash.split('/')[1]||'duas'; const box=$('companion-content');box.replaceChildren(); message('');
    document.querySelectorAll('#essentials nav a').forEach(a=>{if(a.hash.endsWith('/'+section))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(section==='calendar') {
      box.append(el('h2','Your Islamic calendar'),el('p','Estimated Hijri dates. Confirm Ramadan, Eid and Hajj dates locally.'));
      const about=el('details');about.append(el('summary','How these dates work'),el('p','This uses the calculated civil Hijri calendar, not a moon-sighting announcement. Today advances after local Maghrib when a valid prayer timetable is available. The date picker refers to the daylight date. Use the adjustment below to follow your local calendar.'));box.append(about);
      const label=el('label','Explore a date');label.className='field';const date=el('input');date.type='date';date.value=selectedDay;label.append(date);box.append(label);
      date.onchange=()=>{if(/^\d{4}-\d{2}-\d{2}$/.test(date.value)){selectedDay=date.value;navigate('essentials');}};
      const adjust=el('label','Local calendar adjustment');adjust.className='field';const sel=el('select');for(let i=-2;i<=2;i++)sel.add(new Option((i>0?'+':'')+i+' days',String(i)));sel.value=String(calendar.offset||0);adjust.append(sel);box.append(adjust);
      sel.onchange=()=>{const next={...calendar,offset:Number(sel.value)};if(save('akhlaq.calendar.v1',next)){calendar=next;navigate('essentials');refresh(schedule);}else message('Could not save adjustment.');};
      box.append(el('h3',hlabel(selectedDay)));
      const matches=eventsFor(selectedDay,data.events,calendar.offset); if(!matches.length)box.append(el('p','No featured observance for this estimated date. A quiet day is still a good day for a small practice.'));matches.forEach(e=>box.append(eventCard(e)));
      const noteLabel=el('label','Private note for this date');noteLabel.className='field';const note=el('textarea');note.maxLength=1000;note.value=stored('akhlaq.calendar.note.'+selectedDay).text||'';noteLabel.append(note);const keep=el('button','Save date note');keep.onclick=()=>message(save('akhlaq.calendar.note.'+selectedDay,{text:note.value})?'Date note saved on this device.':'Could not save note.');box.append(noteLabel,keep,el('h3','Coming up · next 60 days'));
      const seen=new Set();for(let i=0;i<60;i++){const day=shift(today(),i);for(const e of eventsFor(day,data.events,calendar.offset))if(!seen.has(e.id)){seen.add(e.id);const b=el('button',day+' · '+e.title);b.onclick=()=>{selectedDay=day;navigate('essentials');};box.append(b);}}
    } else if(section==='kalimat') {
      box.append(el('h2','The six kalimat'),el('p','Six traditional learning texts. Open one to read and practise at your own pace.'));
      const about=el('details');about.className='source-notice';about.append(el('summary','About the wording & sources'),el('p',data.notice),source(data.kalimaSource,'About this teaching collection ↗'),source('https://masnoondua.com/six-kalimas/','Traditional Arabic wording ↗'));box.append(about);
      for(const k of data.kalimat){const d=el('details');d.className='learning-card';d.append(el('summary',k.title));const ar=el('p',k.arabic);ar.lang='ar';ar.dir='rtl';ar.className='source-text';d.append(ar,el('p','Meaning in brief (Akhlaq summary): '+k.summary)); const b=el('button'); const render=()=>{const known=stored('akhlaq.kalimat.v1')[k.id]===true;b.textContent=known?'Practised · undo':'Mark as practised';b.setAttribute('aria-pressed',String(known));};render();b.onclick=()=>{const v=stored('akhlaq.kalimat.v1');v[k.id]=v[k.id]!==true;if(save('akhlaq.kalimat.v1',v))render();else message('Could not save progress.');};d.append(b);box.append(d);}
    } else if(section==='pillars') {
      box.append(el('h2','Five pillars of Islam'),el('p','An introduction based on Sahih al-Bukhari 8. These summaries do not replace learning the conditions and exemptions from a qualified teacher.'));
      data.pillars.forEach(p=>{const card=el('article');card.className='learning-card';card.append(el('h3',p.title),el('p',p.summary),source(p.source));box.append(card);});
    } else {
      box.append(el('h2','Quranic duas'),el('p','Open a passage for its complete Arabic text, English or Urdu translation, source notices and verse-by-verse listening. Some verses include both supplication and surrounding context.'));
      data.duas.forEach(d=>{const card=el('article');card.className='learning-card';card.append(el('h3',d.title),source('#quran/'+d.ref,'Read & listen · Quran '+d.ref));box.append(card);});
    }
  }
  function syncAlerts(explicit=false) {
    if(!window.AkhlaqNative?.alerts){$('alert-status').textContent='Android APK required for closed-app alerts. In the browser, use the prayer calendar export.';return;}
    if(prefs.mode!=='off' && !getSettings().locatedAt && getSettings().city!=='Manual coordinates'){$('alert-status').textContent='Use location access or save your own coordinates before enabling alerts.';return;}
    const key=JSON.stringify([getSettings(),prefs,today()]);if(!explicit&&key===lastAlerts)return;
    try {
      const s=getSettings(),days=[];if(prefs.mode!=='off')for(let i=0;i<90;i+=7){const q=new URLSearchParams({lat:s.latitude,lon:s.longitude,zone:s.zone,method:s.method,madhab:s.madhab,highLatitude:s.highLatitude,offsets:s.offsets.join(','),date:shift(today(),i)});days.push(...calculate(q).days);}
      const events=alertEvents(days.slice(0,90),prefs.prayers,Number(prefs.lead));
      window.AkhlaqNative.alerts(JSON.stringify({mode:prefs.mode,events,explicit}));lastAlerts=key;
    }catch{$('alert-status').textContent='Could not prepare alerts. Check location and prayer settings.';}
  }
  async function refresh(next) {schedule=next;try{await load();let day=today();const maghrib=Date.parse(schedule?.days?.[0]?.times?.maghrib);if(Number.isFinite(maghrib)&&Date.now()>=maghrib)day=shift(day,1);$('calendar-today').textContent=hlabel(day);$('hijri-date').textContent=hlabel(day);$('calendar-event').textContent=eventsFor(day,data.events,calendar.offset).map(e=>e.title).join(' · ')||'Explore upcoming dates or keep a private note.';}catch{$('calendar-event').textContent='Calendar content unavailable. Reopen to retry.';}syncAlerts();}
  window.addEventListener('akhlaq-alert-refresh',()=>{lastAlerts='';syncAlerts();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastAlerts='';syncAlerts();}});
  $('alert-mode').value=prefs.mode;$('alert-lead').value=String(prefs.lead);
  for(const name of ['fajr','dhuhr','asr','maghrib','isha']){const l=el('label');const c=el('input');c.type='checkbox';c.value=name;c.checked=prefs.prayers.includes(name);l.append(c,document.createTextNode(name[0].toUpperCase()+name.slice(1)));$('alert-prayers').append(l);}
  $('alert-save').onclick=()=>{const next={mode:$('alert-mode').value,lead:Number($('alert-lead').value),prayers:[...document.querySelectorAll('#alert-prayers input:checked')].map(c=>c.value)};if(save('akhlaq.alerts.v1',next)){prefs=next;syncAlerts(true);}else $('alert-status').textContent='Could not save alert preferences.';};
  $('alert-permission').hidden=!window.AkhlaqNative?.alarmAccess;
  $('alert-permission').onclick=()=>window.AkhlaqNative?.alarmAccess?.();
  $('story-pause').onclick=()=>{if(window.AkhlaqNative?.narrate)window.AkhlaqNative.narrate('{"action":"toggle"}');else if(window.speechSynthesis){if(speechSynthesis.paused)speechSynthesis.resume();else speechSynthesis.pause();$('story-reader-status').textContent=speechSynthesis.paused?'Paused':'Reading aloud';}};
  $('story-stop').onclick=()=>{window.AkhlaqNative?.narrate?.('{"action":"stop"}');window.speechSynthesis?.cancel();$('story-reader').hidden=true;};
  window.addEventListener('akhlaq-alert-status',e=>{$('alert-status').textContent=e.detail;});
  setInterval(()=>{if(window.AkhlaqNative?.narrationStatus){const state=JSON.parse(window.AkhlaqNative.narrationStatus());if(state.title){$('story-reader').hidden=false;$('story-reader-title').textContent=state.title;$('story-reader-status').textContent=state.status;}}},1000);
  return {navigate,refresh};
}
