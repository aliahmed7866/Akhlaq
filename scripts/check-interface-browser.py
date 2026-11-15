"""UI tasks, theme persistence and phone/landscape captures. No live audio needed."""
import os
from pathlib import Path
import socket
import subprocess
from playwright.sync_api import sync_playwright, expect

repo = Path(__file__).resolve().parents[1]
output = Path(os.getenv('QA_OUTPUT', str(repo / 'android/app/build/ui-review')))
output.mkdir(parents=True, exist_ok=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
server = subprocess.Popen(['node', 'server.mjs'], cwd=repo, env={**os.environ, 'PORT': str(port)}, stdout=subprocess.PIPE, text=True)
try:
    assert 'Akhlaq is running' in server.stdout.readline()
    with sync_playwright() as p:
        options = dict(args=['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu', '--disable-dev-shm-usage'])
        if os.getenv('CHROMIUM_PATH'): options['executable_path'] = os.environ['CHROMIUM_PATH']
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width':390,'height':844}, service_workers='block', reduced_motion='reduce')
        page = context.new_page(); errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        base = f'http://127.0.0.1:{port}/'
        page.goto(base)
        expect(page.locator('#prayers li')).to_have_count(6)
        expect(page.locator('html')).to_have_attribute('data-theme','dark')
        expect(page.locator('.tab-bar svg[aria-hidden=true]')).to_have_count(5)
        page.locator('#prayer-tools > summary').click()
        expect(page.locator('#week')).to_be_visible()
        expect(page.locator('#prayer-method')).to_contain_text('Asr')
        page.locator('#prayer-tools > summary').click()
        # The reader starts with verses, while search/settings remain reachable.
        page.get_by_role('link',name='Quran',exact=True).click()
        expect(page.locator('#quran-chapter')).to_be_visible()
        expect(page.locator('#quran-query')).to_be_hidden()
        expect(page.locator('.ayah-arabic').first).to_be_visible()
        page.locator('#reader-tools > summary').click()
        page.locator('#quran-query').fill('2:255')
        page.locator('#quran-search button').click()
        expect(page.locator('.ayah[aria-current]')).to_have_attribute('data-verse','255')
        expect(page.locator('.ayah[aria-current]')).to_be_focused()
        page.locator('.ayah[aria-current] [data-bookmark]').click()
        page.locator('#quran-saved > summary').click()
        expect(page.locator('#quran-saved-list')).to_contain_text('2:255')
        page.locator('#quran-saved-list button').first.click()
        expect(page.locator('.ayah[aria-current]')).to_be_focused()
        # Focus mode can always be left without losing saved reading controls.
        page.locator('#reader-focus').click()
        expect(page.locator('#reader-tools')).to_be_hidden()
        page.locator('#reader-focus').click()
        expect(page.locator('#reader-tools')).to_be_visible()
        page.locator('#reader-tools > summary').click()
        page.locator('[data-reader-preset="arabic"]').click()
        expect(page.locator('#reader-mode-label')).to_have_text('Arabic only')
        page.locator('[data-reader-preset="both"]').click()
        expect(page.locator('#reader-mode-label')).to_have_text('Arabic → English')
        # Theme preference is independent of the app's text-size setting.
        page.goto(base+'#settings')
        page.locator('#reading-comfort > summary').click()
        page.locator('#app-text-size').select_option('125')
        page.locator('#app-theme').select_option('light')
        page.reload()
        expect(page.locator('html')).to_have_attribute('data-theme','light')
        expect(page.locator('#app-text-size')).to_have_value('125')
        page.locator('#reading-comfort > summary').click()
        page.locator('#app-text-size').select_option('100')
        page.locator('#app-theme').select_option('system')
        page.emulate_media(color_scheme='dark')
        expect(page.locator('html')).to_have_attribute('data-theme','dark')
        page.emulate_media(color_scheme='light')
        expect(page.locator('html')).to_have_attribute('data-theme','light')
        page.locator('#app-theme').select_option('dark')
        page.emulate_media(color_scheme='light')
        expect(page.locator('html')).to_have_attribute('data-theme','dark')
        # Counter phrase, persisted count and cancellation are visible and usable.
        page.goto(base+'#dhikr')
        page.locator('#dhikr-type').select_option('hawqala')
        expect(page.locator('#dhikr-arabic')).to_have_text('لا حول ولا قوة إلا بالله')
        page.locator('#dhikr-add').click()
        expect(page.locator('#dhikr-count')).to_have_text('1')
        page.reload()
        page.locator('#dhikr-type').select_option('hawqala')
        expect(page.locator('#dhikr-count')).to_have_text('1')
        page.locator('#dhikr-reset').click()
        expect(page.locator('#dhikr-reset-dialog')).to_be_visible()
        page.get_by_role('button',name='Cancel',exact=True).click()
        expect(page.locator('#dhikr-count')).to_have_text('1')
        page.locator('#dhikr-minus').click()
        expect(page.locator('#dhikr-count')).to_have_text('0')
        # Both palettes, open controls, small landscape and larger screens.
        failures = []
        for theme in ['dark','light']:
            page.goto(base+'#settings')
            if not page.locator('#reading-comfort').evaluate('(e)=>e.open'):
                page.locator('#reading-comfort > summary').click()
            page.locator('#app-theme').select_option(theme)
            page.goto(base+'#learn')
            expect(page.locator('#learn-query')).to_be_visible()
            # Search hints have readable contrast in both explicitly chosen themes.
            ratio = page.locator('#learn-query').evaluate('''input => {
              const luminance = color => {
                const channels = color.match(/[\\d.]+/g).slice(0,3).map(n => Number(n)/255)
                  .map(v => v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
                return channels.reduce((sum,v,i) => sum + v*[.2126,.7152,.0722][i],0);
              };
              const background = luminance(getComputedStyle(input).backgroundColor);
              const text = luminance(getComputedStyle(input,'::placeholder').color);
              return (Math.max(background,text)+.05)/(Math.min(background,text)+.05);
            }''')
            assert ratio >= 4.5, (theme, 'placeholder contrast', ratio)
            assert page.evaluate('getComputedStyle(document.body).backgroundImage !== "none"')
            for route in ['home','quran','qibla','practice','dhikr','learn','essentials','settings']:
                page.goto(base+'#'+route)
                page.wait_for_timeout(80)
                if route=='quran': expect(page.locator('.ayah')).not_to_have_count(0)
                for width,height in [(390,844),(844,390),(1024,768)]:
                    page.set_viewport_size({'width':width,'height':height})
                    page.evaluate('window.scrollTo(0,0)')
                    page.wait_for_timeout(50)
                    overflow=page.evaluate('''() => document.documentElement.scrollWidth>innerWidth+1''')
                    if overflow: failures.append((theme,route,width,height))
                    if width==390:
                        page.screenshot(path=str(output/f'{theme}-{route}.png'))
                # Expanded reader/settings also fit on a narrow phone.
                if route in ['quran','settings']:
                    page.set_viewport_size({'width':320,'height':640})
                    page.locator(f'#{route} details').evaluate_all('(items)=>items.forEach(e=>e.open=true)')
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.set_viewport_size({'width':390,'height':844})
        assert not failures, failures
        # The player stays above navigation and scrolls internally in landscape.
        for size in [16,32]:
            page.set_viewport_size({'width':844,'height':390})
            page.evaluate('''(size) => {
              document.documentElement.style.fontSize = size + 'px';
              document.querySelector('#quran-player').hidden = false;
              document.querySelector('#playing-verse').textContent = 'Al-Fatihah 1:1';
              document.body.classList.add('audio-open');
            }''', size)
            page.wait_for_timeout(100)
            player = page.locator('#quran-player').bounding_box()
            nav = page.locator('.tab-bar').bounding_box()
            assert player['y'] >= 0 and abs(player['y']+player['height']-nav['y']) < 2
            page.locator('#player-mode').scroll_into_view_if_needed()
            mode = page.locator('#player-mode').bounding_box()
            assert mode['y'] >= player['y'] and mode['y']+mode['height'] <= nav['y']+1
        page.evaluate('''() => {
          document.documentElement.style.fontSize = '16px';
          document.querySelector('#quran-player').hidden = true;
          document.body.classList.remove('audio-open');
        }''')
        page.set_viewport_size({'width':390,'height':844})
        page.goto(base+'#settings')
        if not page.locator('#reading-comfort').evaluate('(e)=>e.open'):
            page.locator('#reading-comfort > summary').click()
        page.evaluate('() => { Storage.prototype.setItem=()=>{throw Error("Full")}; }')
        page.locator('#app-theme').select_option('dark')
        expect(page.locator('#theme-status')).to_contain_text('could not save')
        expect(page.locator('html')).to_have_attribute('data-theme','dark')
        assert not errors, errors
        browser.close()
        print('Passed UI tasks: reader tools, search/saved verse focus, themes, system preference, persistence, counter controls, storage failure and 48 route/theme/viewport combinations.')
finally:
    server.terminate(); server.wait(timeout=10)
