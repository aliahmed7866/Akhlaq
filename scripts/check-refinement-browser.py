"""Search completeness, saved content, compact playback, seeking and focus visibility."""
import os, socket, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
repo=Path(__file__).resolve().parents[1]
with socket.socket() as sock: sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
server=subprocess.Popen(['node','server.mjs'],cwd=repo,env={**os.environ,'PORT':str(port)},stdout=subprocess.PIPE,text=True)
try:
 assert 'Akhlaq is running' in server.stdout.readline()
 with sync_playwright() as p:
  options={'args':['--no-sandbox','--no-zygote','--single-process','--disable-gpu','--disable-dev-shm-usage']}
  if os.getenv('CHROMIUM_PATH'):options['executable_path']=os.environ['CHROMIUM_PATH']
  browser=p.chromium.launch(**options); page=browser.new_page(viewport={'width':390,'height':844})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));base=f'http://127.0.0.1:{port}/'
  page.goto(base+'#quran/1:1');expect(page.locator('.ayah')).to_have_count(7)
  page.locator('#reader-find').click();expect(page.locator('#quran-query')).to_be_focused()
  page.locator('#quran-query').fill('Allah');page.locator('#quran-search button').click()
  expect(page.locator('#quran-results button')).to_have_count(15)
  first=page.locator('#quran-results button').first.inner_text()
  page.locator('#quran-search-next').click();expect(page.locator('#quran-results button').first).to_be_focused()
  second=page.locator('#quran-results button').first.inner_text();assert first!=second
  page.locator('#quran-results button').first.click();expect(page.locator('#quran-search-return')).to_be_visible()
  page.locator('#quran-search-return').click();assert page.locator('#quran-results button').first.inner_text()==second
  # Reach every result, including the formerly inaccessible late-surah matches.
  traversal=page.evaluate('''()=>{
    const prev=document.querySelector('#quran-search-previous'),next=document.querySelector('#quran-search-next');
    while(!prev.disabled)prev.click();const refs=[];let pages=0;
    do {refs.push(...[...document.querySelectorAll('#quran-results strong')].map(x=>x.textContent));pages++;if(next.disabled)break;next.click();}while(pages<500);
    return {count:refs.length,unique:new Set(refs).size,pages,status:document.querySelector('#quran-search-status').textContent,last:refs.at(-1),disabled:next.disabled};
  }''')
  assert traversal['count']==traversal['unique'] and traversal['count']>1000 and traversal['disabled'],traversal
  assert str(traversal['count'])==traversal['status'].split(' matches')[0].replace(',',''),traversal
  page.locator('#quran-search-clear').click();expect(page.locator('#quran-query')).to_be_focused()
  page.locator('#quran-query').fill('۱۱۴:۶');page.locator('#quran-search button').click()
  expect(page.locator('.ayah[aria-current]')).to_have_attribute('data-verse','6')
  page.locator('[data-bookmark="6"]').click();page.locator('#reader-saved-open').click()
  expect(page.locator('#quran-saved-title')).to_be_focused()
  page.get_by_role('button',name='Remove saved verse 114:6',exact=True).click()
  expect(page.locator('#saved-removal-undo')).to_be_focused();page.locator('#saved-removal-undo').click()
  page.reload();page.locator('#reader-saved-open').click();expect(page.locator('#quran-saved-list li')).to_have_count(1)
  page.locator('#reader-focus').click();page.locator('#reader-saved-open').click()
  expect(page.locator('#quran-saved')).to_be_visible();expect(page.locator('#reader-focus')).to_have_text('Focus reading')
  page.goto(base+'#learn');page.locator('#learn-query').fill('Bukhari 6114');expect(page.locator('#hadith-list > article')).to_have_count(1)
  page.locator('#learn-query').fill('HadeethEnc ۵۳۵۱');expect(page.locator('#hadith-5351')).to_be_visible()
  page.locator('[data-save-hadith="5351"]').click();page.locator('#hadith-saved-shortcut').click()
  expect(page.locator('#learn-count')).to_have_text('1 of 1,018 hadiths');expect(page.locator('#learn-query')).to_have_value('')
  page.reload();page.locator('#hadith-saved-shortcut').click();expect(page.locator('#learn-count')).to_have_text('1 of 1,018 hadiths')
  page.goto(base+'#home');page.locator('#prayer-tools > summary').click();page.get_by_role('link',name='Review prayer calculation',exact=True).click()
  expect(page.locator('#prayer-calculation')).to_have_js_property('open',True)
  expect(page.locator('#prayer-calculation > summary')).to_be_focused()
  browser.close()
  browser=p.chromium.launch(**options)
  # Native contract fixture checks seeking without rebuilding a queue or restarting playback.
  context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('''
    window.commands=[];window.nativeState={ready:true,chapter:1,verse:1,mode:'arabic-urdu',part:'urdu',singleVerse:false,seconds:12,duration:90,playing:false};
    window.AkhlaqNative={status:()=>JSON.stringify(nativeState),command:value=>{const c=JSON.parse(value);commands.push(c);if(c.action==='seek')nativeState.seconds=c.seconds;if(c.action==='pause')nativeState.playing=false;if(c.action==='resume')nativeState.playing=true;dispatchEvent(new CustomEvent('akhlaq-native-state',{detail:nativeState}));}};
    window.publish=()=>dispatchEvent(new CustomEvent('akhlaq-native-state',{detail:nativeState}));
  ''')
  page.goto(base+'#quran/1:1');expect(page.locator('#quran-player')).to_be_visible()
  page.evaluate("window.statusChanges=0;new MutationObserver(r=>statusChanges+=r.length).observe(document.querySelector('#quran-audio-status'),{childList:true});nativeState.seconds=13;publish();publish();publish();")
  page.wait_for_timeout(50);assert page.evaluate('statusChanges')==0,'Repeated unchanged screen-reader announcements'
  page.evaluate('nativeState.seconds=12;publish()')
  compact=page.locator('#quran-player').bounding_box()['height'];page.locator('#player-expand').click()
  expect(page.locator('#player-mode')).to_be_visible();assert page.locator('#quran-player').bounding_box()['height']>compact
  expect(page.locator('#player-time')).to_have_text('0:12 / 1:30')
  page.locator('#player-seek').focus();page.locator('#player-seek').press('ArrowRight')
  assert page.evaluate("commands.at(-1).action==='seek' && commands.at(-1).track==='1:1:arabic-urdu:urdu:false' && commands.at(-1).seconds>12 && !nativeState.playing")
  before=page.evaluate('commands.length')
  page.locator('#player-seek').dispatch_event('pointerdown')
  page.evaluate("nativeState.verse=2;nativeState.seconds=0;publish()")
  page.locator('#player-seek').evaluate("e=>{e.value='40';e.dispatchEvent(new Event('input',{bubbles:true}));}");page.locator('#player-seek').dispatch_event('change')
  assert page.evaluate('commands.length')==before,'A late gesture sought a different verse'
  expect(page.locator('#player-view-status')).to_contain_text('next part')
  page.evaluate('nativeState.duration=0;publish()');expect(page.locator('#player-seek')).to_be_disabled()
  page.evaluate('nativeState.duration=90;publish()')
  page.locator('#player-expand').click();page.reload();expect(page.locator('#player-mode')).to_be_hidden()
  page.locator('#player-toggle').click();assert page.evaluate('nativeState.playing')
  # Inspect expanded and compact controls at large text and short-screen sizes.
  output=repo/'android/app/build/refinement-review';output.mkdir(parents=True,exist_ok=True)
  failures=[]
  for width,height in [(320,640),(390,844),(844,390)]:
   page.set_viewport_size({'width':width,'height':height})
   for size in [100,150,200]:
    page.evaluate('(n)=>document.documentElement.style.fontSize=n*16/100+"px"',size)
    for compact_mode in [True,False]:
     if page.locator('#quran-player').get_attribute('data-compact')!=str(compact_mode).lower():page.locator('#player-expand').click()
     page.wait_for_timeout(60)
     result=page.evaluate('''()=>{
       const nodes=[...document.querySelectorAll('#quran-player button,#quran-player select,#quran-player input,#playing-verse')].filter(e=>e.getClientRects().length);
       const overlap=[];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i].getBoundingClientRect(),b=nodes[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlap.push([nodes[i].id,nodes[j].id]);}
       return {overlap,overflow:document.documentElement.scrollWidth>innerWidth+1};
     }''')
     if result['overflow'] or result['overlap']:failures.append((width,height,size,compact_mode,result))
     for selector in ['#reader-find','#reader-saved-open','#quran-play','.ayah button[data-bookmark="1"]','#quran-next']:
      target=page.locator(selector)
      if target.is_disabled():continue
      target.focus();page.wait_for_timeout(20)
      visible=target.evaluate('''e=>{const r=e.getBoundingClientRect(),bar=document.querySelector('#quran-player').getBoundingClientRect();return r.top<bar.top-2&&r.bottom>2;}''')
      if not visible:failures.append((width,height,size,compact_mode,'obscured focus',selector))

     if width==390 and size==100:page.screenshot(path=str(output/('player-compact.png' if compact_mode else 'player-expanded.png')))
  assert not failures,failures
  assert not errors,errors
  print('Passed: all Quran search results, result return, digit references, saved removal/undo, hadith reference and saved shortcuts, native seek identity and bounds, compact persistence, 18 player layouts.')
  browser.close()
finally:
 server.terminate();server.wait(timeout=5)
