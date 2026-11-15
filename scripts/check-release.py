"""Fail the release pipeline if offline content or the privacy notice is missing."""
import json
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

manifest = Path(__file__).resolve().parents[1] / 'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml'
root = ET.parse(manifest).getroot()
android = '{http://schemas.android.com/apk/res/android}'
assert root.get('package') == 'uk.akhlaq.app', 'Preview package in release'
sdk = root.find('uses-sdk')
assert int(sdk.get(android + 'targetSdkVersion')) >= 36, 'Outdated target API'
assert sdk.get(android + 'minSdkVersion') == '26'
app = root.find('application')
assert app.get(android + 'debuggable', 'false') == 'false', 'Debuggable production app'
assert app.get(android + 'usesCleartextTraffic') == 'false'
assert app.get(android + 'allowBackup') == 'false'
permissions = {p.get(android + 'name') for p in root.findall('uses-permission')}
for forbidden in ['ACCESS_BACKGROUND_LOCATION', 'MANAGE_EXTERNAL_STORAGE', 'REQUEST_INSTALL_PACKAGES', 'USE_EXACT_ALARM', 'SCHEDULE_EXACT_ALARM']:
    assert 'android.permission.' + forbidden not in permissions, 'Unexpected sensitive permission: ' + forbidden

with zipfile.ZipFile(sys.argv[1]) as bundle:
    names = set(bundle.namelist())
    assert 'base/manifest/AndroidManifest.xml' in names, 'Missing bundle manifest'
    for asset in ['index.html', 'engine.js', 'privacy.html', 'licenses.html', 'quran.json', 'urdu.json']:
        assert 'base/assets/' + asset in names, 'Missing offline asset: ' + asset
    quran = json.loads(bundle.read('base/assets/quran.json'))
    urdu = json.loads(bundle.read('base/assets/urdu.json'))
    assert len(quran['chapters']) == 114
    assert sum(len(chapter['ayahs']) for chapter in quran['chapters']) == 6236
    assert len(urdu['verses']) == 6236
    assert quran['arabicNotice'] and quran['englishTranscript'] and urdu['transcript']
    native = [name for name in names if name.endswith('.so')]
    assert not native, 'Native libraries added: review 16 KB page-size compatibility: ' + str(native)
    assert not any(name.endswith(('.jks', '.keystore')) for name in names), 'Signing key in bundle'
print('Release archive: complete offline Quran editions, notices, privacy page, no native .so libraries or keystores.')
print('Release manifest: production package, API 36+, no debugging, backups or cleartext traffic.')
