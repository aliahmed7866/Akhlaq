"""Hadith library, actual control collisions and simulated keyboard regression checks."""
import gzip, json, os, socket, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
repo=Path(__file__).resolve().parents[1]
catalog=json.loads(gzip.decompress((repo/'data/hadith-index.json.gz').read_bytes()))
extra=next(h for h in catalog['hadiths'] if h['chunk']=='02')
last=catalog['hadiths'][-1]
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
server=subprocess.Popen(['node','server.mjs'],cwd=repo,env={**os.environ,'PORT':str(port)},stdout=subprocess.PIPE,text=True)
try:
 assert 'Akhlaq is running' in server.stdout.readline()
 with sync_playwright() as p:
  options=dict(args=['--no-sandbox','--no-zygote','--single-process','--disable-gpu','--disable-dev-shm-usage'])
  if os.getenv('CHROMIUM_PATH'):options['executable_path']=os.environ['CHROMIUM_PATH']
  browser=p.chromium.launch(**options)
  context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
  page=context.new_page();errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:requests.append(r.url) if '/hadith/' in r.url else None)
  base=f'http://127.0.0.1:{port}/'
  page.goto(base+'#learn')
  expect(page.locator('#hadith-list > article')).to_have_count(20)
  expect(page.locator('#learn-count')).to_have_text('1,018 of 1,018 hadiths')
  assert requests==[], 'Closed cards must not fetch the full library'
  first=page.locator('#hadith-list details').first.get_attribute('id')
  page.locator('#hadith-next').click()
  expect(page.locator('#hadith-page')).to_have_text('Page 2 of 51')
  assert page.locator('#hadith-list details').first.get_attribute('id')!=first
  expect(page.locator('#hadith-list summary').first).to_be_focused()
  page.goto(base+'#learn/hadith/'+extra['id'])
  expect(page.locator('#hadith-'+extra['id']+' .hadith-translation')).to_be_visible()
  assert len(requests)==1
  expect(page.locator('#hadith-'+extra['id'])).to_contain_text('HadeethEnc '+extra['id'])
  assert page.locator('#hadith-'+extra['id']+' a[href^="https://sunnah.com"]').count()==0
  page.locator('#hadith-language').select_option('ur')
  expect(page.locator('#hadith-'+extra['id']+' .hadith-translation')).to_have_attribute('lang','ur')
  page.locator('[data-save-hadith="'+extra['id']+'"]').click()
  page.reload()
  expect(page.locator('[data-save-hadith="'+extra['id']+'"]')).to_have_attribute('aria-pressed','true')
  page.locator('#learn-filters > summary').click()
  page.locator('#learn-saved-only').check()
  expect(page.locator('#learn-count')).to_have_text('1 of 1,018 hadiths')
  page.locator('#learn-reset').click()
  expect(page.locator('#learn-count')).to_have_text('1,018 of 1,018 hadiths')
  # Failure on a previously unopened chunk is recoverable without losing the route.
  page.route('**/hadith/'+last['chunk']+'.json',lambda r:r.fulfill(status=503,body='Unavailable'))
  page.goto(base+'#learn/hadith/'+last['id'])
  expect(page.get_by_role('button',name='Retry narration',exact=True)).to_be_visible()
  page.unroute('**/hadith/'+last['chunk']+'.json')
  page.get_by_role('button',name='Retry narration',exact=True).click()
  expect(page.locator('#hadith-'+last['id']+' .hadith-translation')).to_be_visible()
  # Native keyboard shrinks the WebView. Hide overlays while it is open, not the audio element.
  page.goto(base+'#quran')
  page.locator('#reader-tools > summary').click()
  page.evaluate('''()=>{window.originalAudio=document.querySelector('#quran-audio');document.querySelector('#quran-player').hidden=false;document.body.classList.add('audio-open');}''')
  page.locator('#quran-query').focus()
  page.set_viewport_size({'width':390,'height':450})
  expect(page.locator('body')).to_have_class(__import__('re').compile('keyboard-open'))
  expect(page.locator('.tab-bar')).to_be_hidden()
  expect(page.locator('#quran-player')).to_be_hidden()
  assert page.evaluate('originalAudio===document.querySelector("#quran-audio")')
  page.set_viewport_size({'width':390,'height':844})
  expect(page.locator('.tab-bar')).to_be_visible()
  expect(page.locator('#quran-player')).to_be_visible()
  page.locator('#quran-query').blur()
  failures=[]
  routes=['home','quran/1:1','qibla','practice','dhikr','learn/hadith/5351','essentials/calendar','settings']
  for size in [100,150,200]:
   page.evaluate('(size)=>document.documentElement.style.fontSize=16*size/100+"px"',size)
   for width,height in [(320,640),(360,740),(390,844),(844,390)]:
    page.set_viewport_size({'width':width,'height':height})
    for route in routes:
     page.evaluate('(route)=>location.hash=route',route);page.wait_for_timeout(60)
     page.locator('main details').evaluate_all('(nodes)=>nodes.forEach(d=>d.open=true)')
     page.evaluate('''()=>{
       const count=document.querySelector('#dhikr-add');count.dataset.digits='5';document.querySelector('#dhikr-count').textContent='99999';
       document.querySelector('#quran-player').hidden=false;document.body.classList.add('audio-open');
       document.querySelector('#playing-verse').textContent='Al-Baqarah 2:255';
       document.querySelector('#quran-audio-status').textContent='Loading · 2 of 2 · Urdu translation';
     }''')
     collisions=page.evaluate('''()=>{
       const nodes=[...document.querySelectorAll('button,select,summary,a.small-button,.tab-bar a')].filter(e=>e.checkVisibility());
       const group=e=>e.closest('.mini-player')?'player':e.closest('.tab-bar')?'nav':'content';
       const out=[];
       for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
         const a=nodes[i],b=nodes[j];if(group(a)!==group(b)||a.contains(b)||b.contains(a))continue;
         const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
         if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2)out.push([a.id,b.id]);
       }
       for(const button of nodes.filter(e=>e.tagName==='BUTTON')){
         const box=button.getBoundingClientRect(),walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
         while(walker.nextNode()){
           if(!walker.currentNode.textContent.trim())continue;
           const range=document.createRange();range.selectNodeContents(walker.currentNode);
           for(const r of range.getClientRects())if(r.width&&r.height&&(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1))out.push(['text outside',button.id]);
         }
       }
       return out.slice(0,10);
     }''')
     if collisions:failures.append((size,width,route,collisions))
  assert not failures,failures
  assert not errors,errors
  browser.close()
  browser=p.chromium.launch(**options)
  offline=browser.new_context(viewport={'width':390,'height':844})
  page=offline.new_page();page.goto(base+'#learn')
  page.wait_for_function('() => navigator.serviceWorker.controller !== null')
  offline.set_offline(True)
  page.goto(base+'#learn/hadith/'+last['id'])
  expect(page.locator('#hadith-'+last['id']+' .hadith-translation')).to_be_visible()
  page.locator('#hadith-language').select_option('ur')
  expect(page.locator('#hadith-'+last['id']+' .hadith-translation')).to_have_attribute('lang','ur')
  browser.close()
  print('Passed expanded library paging, Urdu, saving, lazy-load retry, offline new narration, keyboard overlays and 96 control/text collision layouts.')
finally:
 server.terminate();server.wait(timeout=10)
