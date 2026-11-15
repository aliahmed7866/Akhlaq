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
for forbidden in ['ACCESS_BACKGROUND_LOCATION', 'MANAGE_EXTERNAL_STORAGE', 'REQUEST_INSTALL_PACKAGES', 'USE_EXACT_ALARM']:
    assert 'android.permission.' + forbidden not in permissions, 'Unexpected sensitive permission: ' + forbidden

expected_permissions = {'INTERNET','ACCESS_NETWORK_STATE','ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION',
    'FOREGROUND_SERVICE','FOREGROUND_SERVICE_MEDIA_PLAYBACK','FOREGROUND_SERVICE_DATA_SYNC',
    'WAKE_LOCK','POST_NOTIFICATIONS','RECEIVE_BOOT_COMPLETED','SCHEDULE_EXACT_ALARM'}
assert {p.removeprefix('android.permission.') for p in permissions if p.startswith('android.permission.')} == expected_permissions, 'Android permission inventory changed; review Data safety and declarations'
for component in app:
    if component.tag in ('service','receiver','provider') and component.get(android+'name') != 'uk.akhlaq.app.PlaybackService':
        assert component.get(android+'exported','false') == 'false', 'Unexpected externally accessible component'
version_file = Path(__file__).resolve().parents[1] / 'android/version.properties'
version = dict(line.split('=',1) for line in version_file.read_text().splitlines() if '=' in line)
assert root.get(android+'versionCode') == version['versionCode']
assert root.get(android+'versionName') == version['versionName']

with zipfile.ZipFile(sys.argv[1]) as bundle:
    names = set(bundle.namelist())
    assert 'base/manifest/AndroidManifest.xml' in names, 'Missing bundle manifest'
    for asset in ['index.html', 'location.js', 'interface.js', 'player-view.js', 'engine.js', 'privacy.html', 'licenses.html', 'quran.json', 'urdu.json', 'learning.js', 'hadith.json', 'hadith-index.json', 'learning-content.json', 'companion.js', 'devotional.json', 'adhan.oga']:
        assert 'base/assets/' + asset in names, 'Missing offline asset: ' + asset
    quran = json.loads(bundle.read('base/assets/quran.json'))
    urdu = json.loads(bundle.read('base/assets/urdu.json'))
    assert len(quran['chapters']) == 114
    assert sum(len(chapter['ayahs']) for chapter in quran['chapters']) == 6236
    assert len(urdu['verses']) == 6236
    assert quran['arabicNotice'] and quran['englishTranscript'] and urdu['transcript']
    learning = json.loads(bundle.read('base/assets/learning-content.json'))
    hadith = json.loads(bundle.read('base/assets/hadith.json'))
    assert len(hadith['hadiths']) == 12 and len(learning['stories']) == 8
    catalog = json.loads(bundle.read('base/assets/hadith-index.json'))
    assert len(catalog['hadiths']) == 1018
    import hashlib
    for chunk, meta in catalog['chunks'].items():
        body = bundle.read('base/assets/hadith/' + chunk + '.json')
        assert hashlib.sha256(body).hexdigest() == meta['sha256']
        assert len(json.loads(body)['hadiths']) == meta['count']
    assert all(hadith['editions'][lang]['transcript'] for lang in ['en','ur'])
    native = [name for name in names if name.endswith('.so')]
    assert not native, 'Native libraries added: review 16 KB page-size compatibility: ' + str(native)
    assert not any(name.endswith(('.jks', '.keystore')) for name in names), 'Signing key in bundle'
print('Release archive: complete offline Quran editions, notices, privacy page, no native .so libraries or keystores.')
print('Release manifest: production package, API 36+, no debugging, backups or cleartext traffic.')
