"""Build a small deployable privacy/support site from the exact in-app policy.
No third-party scripts, fonts or analytics. Hosting remains an explicit release step.
"""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
out=root/'android/app/build/policy-site'
out.mkdir(parents=True,exist_ok=True)
policy=(root/'public/privacy.html').read_text().replace('href="/style.css"','href="style.css"').replace('href="/#settings">← Akhlaq settings','href="index.html">← Akhlaq support')
(out/'privacy.html').write_text(policy)
(out/'style.css').write_text('body{font:18px/1.65 system-ui,sans-serif;color:#142d29;background:#f7faf8;margin:0}header,main{max-width:760px;margin:auto;padding:24px}a{color:#08644f;overflow-wrap:anywhere}h1{font-size:2rem}h2{font-size:1.35rem;margin-top:2rem}p{overflow-wrap:anywhere}:focus-visible{outline:3px solid #08644f;outline-offset:4px}')
(out/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Akhlaq support</title><link rel="stylesheet" href="style.css"><main><h1>Akhlaq support</h1><p>Akhlaq is a standalone Android companion for Quran reading, prayer times and daily practice.</p><p><a href="privacy.html">Read the privacy policy</a></p><h2>Help and corrections</h2><p><a href="https://github.com/aliahmed7866/Akhlaq/issues">Report an app issue or content-mapping correction</a>. This is a public issue tracker: do not post private reflections, location coordinates or credentials.</p><h2>Your data</h2><p>Akhlaq has no accounts. In the Android app, open Settings → About, privacy &amp; help → Erase my data to remove local records and downloads. Exported copies must be deleted separately from their saved location.</p><h2>Common checks</h2><p>For location, enable phone location and grant Akhlaq permission when requested. Check the prayer calculation method against your mosque. For background audio and reminders, review Android notification and battery settings. Internet access is needed to stream or download audio; bundled text is available offline.</p></main></html>''')
(out/'.nojekyll').touch()
print(out)
