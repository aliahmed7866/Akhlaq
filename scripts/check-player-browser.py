"""Optional browser regression: pip install playwright; playwright install chromium.
Run from the repository: python scripts/check-player-browser.py.
Set CHROMIUM_PATH to use an existing Chromium executable.
Uses generated audio, not downloaded Quran recordings.
"""
import io
import math
import os
import re
from pathlib import Path
import socket
import struct
import subprocess
import wave
from playwright.sync_api import sync_playwright, expect

repo = Path(__file__).resolve().parents[1]
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
stream = io.BytesIO()
with wave.open(stream, 'wb') as wav:
    wav.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    wav.writeframes(b''.join(struct.pack('<h', int(1000 * math.sin(i * math.tau * 440 / 8000))) for i in range(24000)))
server = subprocess.Popen(['node', 'server.mjs'], cwd=repo, env={**os.environ, 'PORT': str(port)}, stdout=subprocess.PIPE, text=True)
try:
    assert 'Akhlaq is running' in server.stdout.readline()
    with sync_playwright() as p:
        launch = {'args': ['--no-sandbox', '--no-zygote', '--single-process', '--disable-gpu', '--disable-dev-shm-usage']}
        if os.getenv('CHROMIUM_PATH'):
            launch['executable_path'] = os.environ['CHROMIUM_PATH']
        browser = p.chromium.launch(**launch)
        context = browser.new_context(viewport={'width': 320, 'height': 760}, is_mobile=True, has_touch=True)
        def audio_response(route):
            body = stream.getvalue()
            match = re.fullmatch(r'bytes=(\d+)-(\d*)', route.request.headers.get('range', ''))
            headers = {'Accept-Ranges': 'bytes'}
            status = 200
            if match:
                start = int(match[1])
                end = min(int(match[2]) if match[2] else len(body) - 1, len(body) - 1)
                headers['Content-Range'] = f'bytes {start}-{end}/{len(body)}'
                body = body[start:end + 1]
                status = 206
            headers['Content-Length'] = str(len(body))
            route.fulfill(status=status, body=body, content_type='audio/wav', headers=headers)
        for host in ['cdn.islamic.network', 'everyayah.com', 'd.quranenc.com']:
            context.route('https://' + host + '/**', audio_response)
        context.add_init_script('''
          window.phoneActions = {};
          const original = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
          navigator.mediaSession.setActionHandler = (name, fn) => { window.phoneActions[name] = fn; original(name, fn); };
        ''')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        url = f'http://127.0.0.1:{port}/#quran/1:1'
        page.goto(url)
        expect(page.locator('#quran-voice')).to_be_visible()
        page.locator('#quran-voice').select_option('arabic-urdu')
        page.evaluate('''() => {
          window.playerElement = document.querySelector('#quran-audio');
          window.tracks = [];
          playerElement.addEventListener('playing', () => tracks.push(playerElement.src));
        }''')
        page.locator('#quran-play').click()
        expect(page.locator('#quran-audio-status')).to_have_text('1 of 2 · Arabic recitation')
        assert page.evaluate('navigator.mediaSession.playbackState') == 'playing'
        assert page.evaluate('phoneActions.previoustrack === null')
        page.evaluate("document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'))")
        assert page.locator('#quran-audio').evaluate('(a) => !a.paused')
        page.get_by_role('link', name='Today', exact=True).click()
        page.wait_for_function('() => tracks.length >= 4')
        page.evaluate('phoneActions.pause()')
        tracks = page.evaluate('tracks.slice(0, 4)')
        assert tracks[0].endswith('/ar.alafasy/1.mp3')
        assert tracks[1].endswith('/001001.mp3')
        assert tracks[2].endswith('/ar.alafasy/2.mp3')
        assert tracks[3].endswith('/001002.mp3')
        assert page.evaluate('playerElement === document.querySelector("#quran-audio")')
        assert page.evaluate('navigator.mediaSession.metadata.artist') == '2 of 2 · Urdu translation'
        assert page.evaluate('navigator.mediaSession.playbackState') == 'paused'
        page.evaluate('phoneActions.seekto({seekTime: 1.1})')
        page.wait_for_function('() => Math.abs(JSON.parse(localStorage.getItem("akhlaq.listening.v1")).seconds - 1.1) < 0.1')
        page.reload()
        expect(page.locator('#player-toggle')).to_have_text('Resume')
        expect(page.locator('#playing-verse')).to_contain_text('1:2')
        assert page.locator('#quran-audio').evaluate('(a) => a.paused')
        assert page.locator('#quran-audio').evaluate('(a) => a.src.endsWith("/001002.mp3")')
        page.locator('#player-toggle').click()
        page.wait_for_function('() => document.querySelector("#quran-audio").currentTime >= 1')
        page.evaluate('phoneActions.pause()')
        assert page.locator('#quran-audio').evaluate('(a) => a.currentTime < 2.5')
        page.evaluate('phoneActions.previoustrack()')
        expect(page.locator('#playing-verse')).to_contain_text('1:1')
        expect(page.locator('#quran-audio-status')).to_have_text('1 of 2 · Arabic recitation')
        page.evaluate('phoneActions.stop()')
        expect(page.locator('#quran-player')).to_be_hidden()
        assert page.evaluate('navigator.mediaSession.metadata === null')
        page.reload()
        expect(page.locator('#daily-open')).to_be_visible()
        expect(page.locator('#quran-player')).to_be_hidden()
        assert not errors, errors
        print('Passed: paired progression, lifecycle notifications, app navigation, phone controls, exact-language resume, and explicit stop. Physical Android background/lock-screen behaviour requires device testing.')
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)
