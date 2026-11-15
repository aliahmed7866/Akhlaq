"""Browser-side native bridge regression. Requires Python Playwright and Chromium."""
import gzip
import os
from pathlib import Path
import socket
import subprocess
from playwright.sync_api import sync_playwright, expect
repo = Path(__file__).resolve().parents[1]
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
server = subprocess.Popen(['node', 'server.mjs'], cwd=repo, env={**os.environ,'PORT':str(port)}, stdout=subprocess.PIPE,text=True)
try:
    assert 'Akhlaq is running' in server.stdout.readline()
    with sync_playwright() as p:
        options = dict(args=['--no-sandbox','--no-zygote','--single-process','--disable-gpu','--disable-dev-shm-usage'])
        if os.getenv('CHROMIUM_PATH'): options['executable_path'] = os.environ['CHROMIUM_PATH']
        browser=p.chromium.launch(**options)
        page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/urdu.json',lambda route:route.fulfill(body=gzip.decompress((repo/'data/urdu.json.gz').read_bytes()),content_type='application/json'))
        page.add_init_script('''
          window.nativeState = {ready:true}; window.commands = []; window.sensorCommands = []; window.qiblaBuzzes = 0;
          window.locationRequests = []; window.locationCancellations = []; window.locationMode = 'success'; window.browserLocationCalls = 0;
          navigator.geolocation.getCurrentPosition = (ok,fail) => { browserLocationCalls++; fail({code:2}); };
          window.AkhlaqNative = {
            version: () => '2.0.0-test',
            requestLocation: id => {
              locationRequests.push(id); if(locationMode==='hold')return;
              const errors={disabled:{code:'disabled',message:'Location is switched off on your phone.',action:'device'},permission:{code:'permission',message:'Location permission was not allowed.',action:'app'}};
              const payload=errors[locationMode]?{error:errors[locationMode]}:{coords:{latitude:locationMode==='invalid'?999:53.4808,longitude:-2.2426,accuracy:20}};
              queueMicrotask(()=>dispatchEvent(new CustomEvent('akhlaq-location',{detail:{id,...payload}})));
            },
            cancelLocation: id => locationCancellations.push(id),
            locationSettings: target => { window.openedLocationSettings=target; },
            alerts: value => { window.alertPlan = JSON.parse(value); },
            alarmAccess: () => { window.alarmRequested = true; },
            narrate: value => { window.storyCommand = JSON.parse(value); },
            narrationStatus: () => '{}',
            eraseData: () => { window.eraseRequested = true; },
            status: () => JSON.stringify(nativeState),
            command: value => {
              const command = JSON.parse(value); commands.push(command);
              if (command.action === 'play') nativeState = {ready:true,...command,playing:command.start,finished:false};
              if (command.action === 'pause') nativeState.playing = false;
              if (command.action === 'resume') nativeState.playing = true;
              if (command.action === 'stop') nativeState = {ready:true};
              window.dispatchEvent(new CustomEvent('akhlaq-native-state',{detail:nativeState}));
            },
            compass: enabled => sensorCommands.push(enabled),
            qiblaAligned: () => qiblaBuzzes++,
            exportFile: (name,text,mime) => { window.exported={name,text,mime}; }
          };
        ''')
        page.goto(f'http://127.0.0.1:{port}/#quran/1:1')
        expect(page.locator('#offline-status')).to_have_text('Standalone Android · ready offline')
        expect(page.locator('#install')).to_be_hidden()
        page.locator('[data-reader-preset="arabic-urdu"]').click()
        expect(page.locator('.ayah-urdu').first).to_be_visible()
        page.locator('#reader-focus').click()
        expect(page.locator('#quran-chapter')).to_be_hidden()
        expect(page.locator('#reader-focus')).to_have_text('Show controls')
        expect(page.locator('.ayah-urdu').first).to_be_visible()
        page.locator('#reader-focus').click()
        expect(page.locator('#quran-chapter')).to_be_visible()
        page.locator('#quran-play').click()
        assert page.evaluate('commands.at(-1).mode') == 'arabic-urdu'
        assert page.evaluate('commands.at(-1).part') == 'arabic'
        assert page.locator('#quran-audio').evaluate('(a)=>a.paused && !a.getAttribute("src")')
        expect(page.locator('#player-toggle')).to_have_text('Pause')
        page.locator('#player-toggle').click()
        assert page.evaluate('commands.at(-1).action') == 'pause'
        page.locator('#player-toggle').click()
        assert page.evaluate('commands.at(-1).action') == 'resume'
        page.evaluate("nativeState.part='urdu';nativeState.seconds=12;dispatchEvent(new CustomEvent('akhlaq-native-state',{detail:nativeState}))")
        expect(page.locator('#quran-audio-status')).to_have_text('2 of 2 · Urdu translation')
        page.locator('#reader-tools > summary').click()
        page.get_by_text('Text, size & playback options',exact=True).click()
        page.locator('#quran-autoplay').uncheck()
        assert page.evaluate('commands.at(-1).singleVerse') is True
        assert page.evaluate('commands.at(-1).seconds') == 12
        assert page.evaluate('commands.at(-1).part') == 'urdu'
        page.get_by_text('Offline audio',exact=True).click()
        page.locator('#native-download').click()
        assert page.evaluate('commands.at(-1).action') == 'download'
        assert page.evaluate('commands.at(-1).verse') == 1
        page.get_by_role('link',name='Qibla',exact=True).click()
        expect(page.locator('#compass')).to_be_disabled()
        page.context.grant_permissions(['geolocation'])
        page.context.set_geolocation({'latitude':53.4808,'longitude':-2.2426,'accuracy':20})
        page.locator('#qibla-gps').click()
        expect(page.locator('#compass')).to_be_enabled()
        assert page.evaluate('locationRequests.length') == 1
        assert page.evaluate('browserLocationCalls') == 0
        saved_location=page.evaluate("localStorage.getItem('akhlaq.settings.v1')")
        for mode,action,label in [('disabled','device','Open phone location'),('permission','app','Open app permissions')]:
            page.evaluate('(mode)=>locationMode=mode',mode)
            page.locator('#qibla-gps').click()
            recovery=page.locator('#qibla .location-recovery')
            expect(recovery).to_have_text(label)
            recovery.click()
            assert page.evaluate('openedLocationSettings') == action
            assert page.evaluate("localStorage.getItem('akhlaq.settings.v1')") == saved_location
            expect(page.locator('#qibla-gps')).to_be_enabled()
        page.evaluate("locationMode='hold'")
        page.locator('#qibla-gps').click()
        expect(page.locator('#qibla-gps')).to_be_disabled()
        page.locator('#qibla .location-cancel').click()
        expect(page.locator('#qibla-gps')).to_be_enabled()
        expect(page.locator('#qibla-location-status')).to_contain_text('cancelled')
        assert page.evaluate('locationCancellations.length') > 0
        page.evaluate("locationMode='invalid'")
        page.locator('#qibla-gps').click()
        expect(page.locator('#qibla-location-status')).to_contain_text('invalid location')
        assert page.evaluate("localStorage.getItem('akhlaq.settings.v1')") == saved_location
        page.evaluate("locationMode='success';document.querySelector('[name=offset-fajr]').value='999'")
        page.locator('#qibla-gps').click()
        expect(page.locator('#qibla-location-status')).to_contain_text('Location updated')
        page.evaluate("document.querySelector('[name=offset-fajr]').value='0'")
        page.locator('#compass').click()
        assert page.evaluate('sensorCommands.at(-1)') is True
        page.evaluate("dispatchEvent(new CustomEvent('akhlaq-heading',{detail:{magneticHeading:100,headingAccuracy:5,accuracyStatus:3,beta:0,gamma:0}}))")
        expect(page.locator('#phone-heading')).not_to_have_text('—')
        expect(page.locator('#compass-quality')).to_contain_text('±5°')
        page.evaluate("""async () => {
          const {calculate} = await import('/engine.js');
          const p=calculate(new URLSearchParams('lat=53.4808&lon=-2.2426&zone=Europe%2FLondon'));
          window.compassSample = (overrides={}) => dispatchEvent(new CustomEvent('akhlaq-heading',{detail:{magneticHeading:p.bearing-p.declination,headingAccuracy:5,accuracyStatus:3,beta:0,gamma:0,screenRotation:0,...overrides}}));
          for(let i=0;i<15;i++){compassSample();await new Promise(r=>setTimeout(r,80));}
        }""")
        expect(page.locator('#compass-dial')).to_have_attribute('data-aligned','true')
        assert page.evaluate('qiblaBuzzes') == 1
        page.evaluate('''async () => {for(let i=0;i<15;i++){compassSample();await new Promise(r=>setTimeout(r,80));}}''')
        assert page.evaluate('qiblaBuzzes') == 1, 'A held direction must not buzz continuously'
        page.evaluate('compassSample({magneticStrength:120})')
        expect(page.locator('#needle')).to_be_hidden()
        expect(page.locator('#compass-note')).to_contain_text('interference')
        expect(page.locator('#compass-dial')).to_have_attribute('data-aligned','false')
        page.evaluate("""async () => {for(let i=0;i<15;i++){compassSample({headingAccuracy:null});await new Promise(r=>setTimeout(r,80));}}""")
        expect(page.locator('#compass-dial')).to_have_attribute('data-aligned','false')
        expect(page.locator('#compass-quality')).to_contain_text('accuracy not reported')
        page.wait_for_timeout(1600)
        expect(page.locator('#needle')).to_be_hidden()
        expect(page.locator('#compass-quality')).to_have_text('Readings paused')
        assert page.evaluate('qiblaBuzzes') == 1, 'Unknown accuracy or interference must not buzz'
        page.locator('#qibla-vibrate').uncheck()
        page.locator('#compass-recheck').click()
        assert page.evaluate('sensorCommands.slice(-2)') == [False,True]
        page.evaluate('''async () => {for(let i=0;i<15;i++){compassSample();await new Promise(r=>setTimeout(r,80));}}''')
        assert page.evaluate('qiblaBuzzes') == 1, 'Turning buzz off is respected'
        page.evaluate('compassSample({screenRotation:1})')
        expect(page.locator('#compass-dial')).to_have_attribute('data-aligned','false')
        page.locator('#compass').click()
        assert page.evaluate('sensorCommands.at(-1)') is False
        page.locator('#player-close').click()
        assert page.evaluate('commands.at(-1).action') == 'stop'
        expect(page.locator('#quran-player')).to_be_hidden()
        page.get_by_role('link',name='Settings',exact=True).click()
        page.get_by_text('About, privacy & help',exact=True).click()
        expect(page.locator('#app-version')).to_have_text('Akhlaq · 2.0.0-test')
        page.locator('#erase-app-data').click()
        assert page.evaluate('window.eraseRequested') is True
        page.get_by_role('link',name='Privacy policy',exact=True).click()
        expect(page.get_by_role('heading',name='Akhlaq privacy policy')).to_be_visible()
        page.get_by_role('link',name='← Akhlaq settings').click()
        expect(page.locator('#settings-title')).to_be_visible()
        page.context.grant_permissions(['geolocation'])
        page.context.set_geolocation({'latitude': 53.4808, 'longitude': -2.2426})
        page.get_by_role('link',name='Today',exact=True).click()
        page.locator('#home-gps').click()
        expect(page.locator('#schedule-location')).to_contain_text('My location')
        page.get_by_role('link',name='Settings',exact=True).click()
        page.locator('#gps').click()
        expect(page.locator('#settings-status')).to_contain_text('Location updated')
        page.locator('#reminder-settings summary').click()
        page.locator('#alert-mode').select_option('adhan')
        page.locator('#alert-lead').select_option('10')
        page.locator('#alert-save').click()
        assert page.evaluate('alertPlan.mode') == 'adhan'
        assert page.evaluate('alertPlan.events.length') > 800
        assert page.evaluate('alertPlan.events.every(e => !e.title.includes("Sunrise"))')
        page.locator('#alert-permission').click()
        assert page.evaluate('alarmRequested')
        page.goto(f'http://127.0.0.1:{port}/#learn/stories/musa')
        page.locator('#story-musa button').click()
        assert page.evaluate('storyCommand.id') == 'story-musa'
        page.locator('#story-pause').click()
        assert page.evaluate('storyCommand.action') == 'toggle'
        page.locator('#story-stop').click()
        assert page.evaluate('storyCommand.action') == 'stop'
        assert page.evaluate('browserLocationCalls') == 0
        assert not errors,errors
        print('Passed native bridge: offline Urdu, native-only audio, queue controls, in-place continuity changes, downloads, native location success/recovery/cancel, and compass data.')
        browser.close()
finally:
    server.terminate();server.wait(timeout=5)
