#!/usr/bin/env bash
set -euo pipefail
mkdir -p android/app/build/device-evidence/screenshots
adb shell svc wifi disable
adb shell svc data disable
adb shell settings put system font_scale 1.0
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb logcat -c
# Preserve diagnostics even when a test fails, and keep the original exit status.
set +e
# Keep the test app installed until its private screenshot files are collected.
# AGP otherwise uninstalls both APKs (and deletes those files) after testing.
(cd android && ./gradlew --no-daemon connectedDebugAndroidTest -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true)
result=$?
set -e
adb logcat -d > android/app/build/device-evidence/logcat.txt
adb shell dumpsys webviewupdate > android/app/build/device-evidence/webview.txt
for name in 01-today 02-quran-urdu 03-hadith 04-duas; do
  adb exec-out run-as uk.akhlaq.app.preview cat "files/store-captures/$name.png" > "android/app/build/device-evidence/screenshots/$name.png" || true
done
python3 - "$result" <<'PY'
import json, os, struct, subprocess, sys
from pathlib import Path
root=Path('android/app/build/device-evidence')
captures=[]
for path in sorted((root/'screenshots').glob('*.png')):
    data=path.read_bytes()
    if data[:8]!=b'\x89PNG\r\n\x1a\n':
        print(f'Screenshot collection failed for {path.name}: {data[:200]!r}',file=sys.stderr)
        path.unlink(); continue
    w,h=struct.unpack('>II',data[16:24])
    captures.append({'file':path.name,'width':w,'height':h})
report={'commit':os.getenv('GITHUB_SHA'),'api':subprocess.check_output(['adb','shell','getprop','ro.build.version.sdk'],text=True).strip(),'captureType':'Android emulator; actual bundled debug app; no fake bridge','testExitCode':int(sys.argv[1]),'network':'Wi-Fi and mobile data disabled during tests','screenshots':captures}
(root/'evidence.json').write_text(json.dumps(report,indent=2)+'\n')
if not int(sys.argv[1]): assert len(captures)==4, 'Missing store captures'
PY
exit "$result"
