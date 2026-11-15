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
          window.nativeState = {ready:true}; window.commands = []; window.sensorCommands = [];
          window.AkhlaqNative = {
            version: () => '2.0.0-test',
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
        page.locator('#compass').click()
        assert page.evaluate('sensorCommands.at(-1)') is True
        page.evaluate("dispatchEvent(new CustomEvent('akhlaq-heading',{detail:{webkitCompassHeading:100,webkitCompassAccuracy:5,beta:0,gamma:0}}))")
        expect(page.locator('#phone-heading')).not_to_have_text('—')
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
        assert not errors,errors
        print('Passed native bridge: offline Urdu, native-only audio, queue controls, in-place continuity changes, downloads, and compass data.')
        browser.close()
finally:
    server.terminate();server.wait(timeout=5)
