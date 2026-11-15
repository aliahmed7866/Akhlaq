"""Task and reflow regression. Requires Python Playwright and Chromium."""
import os
import socket
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
repo = Path(__file__).resolve().parents[1]
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
server = subprocess.Popen(['node', 'server.mjs'], cwd=repo, env={**os.environ, 'PORT': str(port)}, stdout=subprocess.PIPE, text=True)
try:
    assert 'Akhlaq is running' in server.stdout.readline()
    with sync_playwright() as p:
        options = dict(args=['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu', '--disable-dev-shm-usage'])
        if os.getenv('CHROMIUM_PATH'): options['executable_path'] = os.environ['CHROMIUM_PATH']
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        page = context.new_page(); errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        base = f'http://127.0.0.1:{port}/'
        page.goto(base)
        expect(page.locator('#daily-hadith-reference')).to_contain_text('Bukhari')
        page.locator('#daily-hadith-open').click()
        expect(page.locator('#hadith-list details[open] > .hadith-body')).to_be_visible()
        page.locator('#learn-query').fill('6114')
        expect(page.locator('#learn-count')).to_have_text('1 of 12 hadiths')
        page.locator('#hadith-list summary').first.click()
        page.locator('#hadith-language').select_option('ur')
        # Changing language must preserve the opened narration.
        expect(page.locator('#hadith-list .hadith-translation')).to_be_visible()
        expect(page.locator('#hadith-list .hadith-translation')).to_have_attribute('dir', 'rtl')
        expect(page.locator('#hadith-list .hadith-translation')).to_have_attribute('lang', 'ur')
        page.locator('[data-save-hadith="5351"]').click()
        page.reload()
        expect(page.locator('#hadith-language')).to_have_value('ur')
        page.locator('#learn-saved-only').check()
        expect(page.locator('#learn-count')).to_have_text('1 of 12 hadiths')
        page.locator('[data-save-hadith="5351"]').click()
        expect(page.locator('#learn-empty')).to_be_visible()
        page.locator('#learn-clear').click()
        expect(page.locator('#learn-count')).to_have_text('12 of 12 hadiths')
        page.locator('[data-learn="practices"]').click()
        page.locator('[data-routine="read"]').click()
        page.get_by_role('link', name='Today', exact=True).click()
        expect(page.locator('#daily-practice-label')).to_have_text('Your chosen routine')
        expect(page.locator('#daily-practice-title')).to_have_text('Read a little Quran')
        page.reload()
        expect(page.locator('#daily-practice-title')).to_have_text('Read a little Quran')
        page.goto(base + '#learn/stories/yusuf')
        expect(page.locator('#story-yusuf')).to_have_attribute('open', '')
        page.locator('#story-yusuf a').first.click()
        expect(page.locator('#quran')).to_be_visible()
        assert page.url.endswith('#quran/12:89')
        page.goto(base + '#settings')
        page.get_by_text('Reading comfort', exact=True).click()
        page.locator('#app-text-size').select_option('200')
        page.reload()
        expect(page.locator('#app-text-size')).to_have_value('200')
        # Check all main routes at narrow, typical phone and tablet widths, both text sizes.
        failures = []
        for size in [100, 200]:
            page.evaluate('(n) => document.documentElement.style.fontSize = (16*n/100) + "px"', size)
            for width in [320, 390, 768]:
                page.set_viewport_size({'width': width, 'height': 844})
                for route in ['', 'quran/1:1', 'qibla', 'practice', 'dhikr', 'settings', 'learn/hadith/5351', 'learn/practices', 'learn/stories/yusuf']:
                    page.evaluate('(r) => location.hash = r', route)
                    if route == 'settings':
                        page.locator('#settings details').evaluate_all('(items) => items.forEach(d => d.open = true)')
                    page.wait_for_timeout(80)
                    overflow = page.evaluate('''() => [...document.querySelectorAll('body *')].filter(e => {
                      const r=e.getBoundingClientRect(); return e.checkVisibility() && r.width && r.height && (r.right>innerWidth+1 || r.left < -1) && !e.closest('.table-wrap') && !e.classList.contains('skip-link');
                    }).map(e=>e.tagName+'#'+e.id+'.'+e.className).slice(0,12)''')
                    if overflow: failures.append((size, width, route, overflow))
                    small = page.evaluate('''() => [...document.querySelectorAll('button, .small-button, select, summary, .checks label, .check-option, .tab-bar a')].filter(e => {
                      const r=e.getBoundingClientRect(); return e.checkVisibility() && r.width && r.height && (r.width<47.9 || r.height<47.9);
                    }).map(e=>e.tagName+'#'+e.id)''')
                    if small: failures.append(('small target', size, width, route, small))
        # Inspect the fixed player independently of live audio timing.
        page.evaluate('''() => {
          document.querySelector('#quran-player').hidden = false;
          document.body.classList.add('audio-open');
        }''')
        for width in [320, 390, 768]:
            page.set_viewport_size({'width': width, 'height': 844})
            page.wait_for_timeout(80)
            assert page.locator('#quran-player').bounding_box()['y'] >= 0
            nav = page.locator('.tab-bar').bounding_box()
            player = page.locator('#quran-player').bounding_box()
            assert abs(player['y'] + player['height'] - nav['y']) < 2
        page.evaluate('''() => {
          document.querySelector('#quran-player').hidden = true;
          document.body.classList.remove('audio-open');
        }''')
        assert not failures, failures
        page.set_viewport_size({'width': 390, 'height': 844})
        page.evaluate('document.documentElement.style.fontSize = "16px"')
        page.goto(base + '#learn/hadith/5351')
        page.locator('#hadith-language').select_option('en')
        output = Path(os.getenv('QA_OUTPUT', '/tmp/akhlaq-qa'))
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(output / 'learning-phone.png'), full_page=False)
        page.goto(base)
        page.evaluate('document.documentElement.style.fontSize = "16px"')
        page.screenshot(path=str(output / 'today-phone.png'), full_page=False)
        # Keyboard skip link must focus content without accidentally changing route.
        page.goto(base + '#learn')
        page.locator('.skip-link').focus(); page.keyboard.press('Enter')
        assert page.url.endswith('#learn')
        expect(page.locator('#main-content')).to_be_focused()
        # A failed first load can be recovered by the visible retry action.
        page.route('**/hadith.json', lambda route: route.fulfill(status=503, body='Unavailable'))
        page.reload()
        expect(page.locator('#learn-retry')).to_be_visible()
        page.unroute('**/hadith.json')
        page.locator('#learn-retry').click()
        expect(page.locator('#learn-count')).to_have_text('12 of 12 hadiths')
        expect(page.locator('#learn-retry')).to_be_hidden()
        # A storage failure must not falsely claim that an item was saved.
        page.evaluate('() => { Storage.prototype.setItem = () => { throw new Error("Storage full"); }; }')
        page.locator('[data-save-hadith="5351"]').click()
        expect(page.locator('#learn-status')).to_contain_text('could not save')
        expect(page.locator('[data-save-hadith="5351"]')).to_have_attribute('aria-pressed', 'false')
        assert not errors, errors
        browser.close()
        browser = p.chromium.launch(**options)
        offline = browser.new_context(viewport={'width': 390, 'height': 844})
        page = offline.new_page()
        page.goto(base + '#learn/hadith/5351')
        page.wait_for_function('() => navigator.serviceWorker.controller !== null')
        offline.set_offline(True)
        page.reload()
        expect(page.locator('#hadith-5351 .hadith-translation')).to_be_visible()
        page.locator('#hadith-language').select_option('ur')
        expect(page.locator('#hadith-5351 .hadith-translation')).to_have_attribute('lang', 'ur')
        page.locator('[data-learn="stories"]').click()
        expect(page.locator('#prophet-stories > details')).to_have_count(8)
        browser.close()
        print('Passed learning tasks, saved preferences, Urdu, references, and 54 route/width/text-size layouts.')
finally:
    server.terminate(); server.wait(timeout=10)
