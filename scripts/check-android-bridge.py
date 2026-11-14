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
        assert not errors,errors
        print('Passed native bridge: offline Urdu, native-only audio, queue controls, in-place continuity changes, downloads, and compass data.')
        browser.close()
finally:
    server.terminate();server.wait(timeout=5)
