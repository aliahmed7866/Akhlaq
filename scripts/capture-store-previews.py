"""Render store graphics and draft screenshots from the shared UI, not an Android emulator.

Requires Python Playwright + Chromium and a prepared data/urdu.json.gz.
Replace UI drafts with final Android device captures before publishing.
"""
import gzip
import os
from pathlib import Path
import socket
import subprocess
from playwright.sync_api import sync_playwright, expect

repo = Path(__file__).resolve().parents[1]
graphics = repo / 'store/graphics'
screens = repo / 'store/screenshots'
screens.mkdir(parents=True, exist_ok=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
server = subprocess.Popen(['node', 'server.mjs'], cwd=repo,
    env={**os.environ, 'PORT': str(port)}, stdout=subprocess.PIPE, text=True)
try:
    assert 'Akhlaq is running' in server.stdout.readline()
    with sync_playwright() as p:
        options = dict(args=['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu', '--disable-dev-shm-usage'])
        if os.getenv('CHROMIUM_PATH'):
            options['executable_path'] = os.environ['CHROMIUM_PATH']
        browser = p.chromium.launch(**options)
        canvas = browser.new_page(viewport={'width': 1024, 'height': 500})
        for source, output, width, height in [
            (graphics / 'feature-1024x500.svg', graphics / 'feature-1024x500.png', 1024, 500),
            (repo / 'public/icons/akhlaq.svg', graphics / 'icon-512.png', 512, 512),
        ]:
            canvas.set_viewport_size({'width': width, 'height': height})
            canvas.set_content('<style>body{margin:0}svg{display:block;width:100%;height:100vh}</style>' + source.read_text())
            canvas.screenshot(path=str(output))
        browser.close()
        browser = p.chromium.launch(**options)
        page = browser.new_page(viewport={'width': 432, 'height': 768}, device_scale_factor=2.5,
                                is_mobile=True, has_touch=True)
        page.route('**/urdu.json', lambda route: route.fulfill(
            body=gzip.decompress((repo / 'data/urdu.json.gz').read_bytes()), content_type='application/json'))
        page.add_init_script('''window.AkhlaqNative = {
            status: () => JSON.stringify({ready:true}), version: () => '2.0.0',
            command: () => {}, compass: () => {}, eraseData: () => {}
        };''')
        page.goto(f'http://127.0.0.1:{port}/#home')
        expect(page.locator('#prayers li')).to_have_count(6)
        page.screenshot(path=str(screens / '01-today-draft.png'))
        page.goto(f'http://127.0.0.1:{port}/#quran/1:1')
        page.locator('[data-reader-preset="arabic-urdu"]').click()
        expect(page.locator('.ayah-urdu').first).to_be_visible()
        page.locator('#reader-focus').click()
        page.evaluate('window.scrollTo(0, 0)')
        page.screenshot(path=str(screens / '02-quran-draft.png'))
        page.get_by_role('link', name='Qibla', exact=True).click()
        page.screenshot(path=str(screens / '03-qibla-draft.png'))
        page.get_by_role('link', name='Practice', exact=True).click()
        page.screenshot(path=str(screens / '04-practice-draft.png'))
        browser.close()
    print('Rendered 512px icon, 1024×500 feature graphic and four 1080×1920 UI drafts.')
finally:
    server.terminate()
    server.wait(timeout=5)
