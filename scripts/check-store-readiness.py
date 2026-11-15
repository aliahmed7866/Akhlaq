"""Validate store materials and report missing production requirements without hiding them.

Inspection runs succeed with a BLOCKED report. --submission requires a signed AAB,
a reachable public privacy page, a chosen support email and review evidence.
This is a project check, not a Google compliance certification.
"""
import argparse, hashlib, json, re, struct, subprocess, sys, zipfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

REPO=Path(__file__).resolve().parents[1]
REQUIRED={
    'contentRights':'Review current text/audio redistribution and download permissions; record evidence.',
    'physicalDeviceChecks':'Record phone checks for background audio, alerts, compass, location and TalkBack.',
    'dataSafety':'Review and submit Data safety answers including provider requests and logs.',
    'foregroundServiceDeclarations':'Complete mediaPlayback/dataSync declarations with actual demonstration recordings.',
    'contentRatingAndAudience':'Complete content rating, target audience, ads and app-access declarations.',
    'playTestingAndAccountAccess':'Confirm Play account verification and the testing/production-access requirements shown for this account.'
}

def inspect(config, bundle=None):
    blockers=[]
    listing=json.loads((REPO/'store/listing.json').read_text())
    for key,limit in [('name',30),('shortDescription',80),('fullDescription',4000),('releaseNotes',500)]:
        assert isinstance(listing[key],str) and 0<len(listing[key])<=limit, f'{key} exceeds {limit} or is empty'
    for filename,size in [('icon-512.png',(512,512)),('feature-1024x500.png',(1024,500))]:
        data=(REPO/'store/graphics'/filename).read_bytes()
        assert data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==size, filename
    versions=dict(line.split('=',1) for line in (REPO/'android/version.properties').read_text().splitlines() if '=' in line)
    assert json.loads((REPO/'package.json').read_text())['version']==versions['versionName'], 'Version mismatch'
    signed=False
    if bundle:
        with zipfile.ZipFile(bundle) as z:
            signed=any(re.fullmatch(r'META-INF/[^/]+\.(RSA|DSA|EC)', n, re.I) for n in z.namelist())
        if signed:
            verify=subprocess.run(['jarsigner','-verify',str(bundle)],capture_output=True,text=True)
            # jarsigner may return 0 for unsigned archives, so require the signature block above too.
            assert verify.returncode==0, 'Invalid bundle signature'
    if not signed: blockers.append('No verified upload-signed Android App Bundle supplied.')
    policy=config.get('privacyPolicyUrl') or ''
    parsed=urlparse(policy)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password:
        blockers.append('Publish the privacy policy at a public HTTPS URL and enter privacyPolicyUrl.')
    email=config.get('supportEmail') or ''
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or email.endswith(('.example','.invalid')):
        blockers.append('Choose the public support email for the Play listing and enter supportEmail.')
    for key,message in REQUIRED.items():
        evidence=config.get('evidence',{}).get(key)
        if not isinstance(evidence,str) or len(evidence.strip())<15: blockers.append(message)
    return {'versionName':versions['versionName'],'versionCode':int(versions['versionCode']),
        'status':'BLOCKED' if blockers else 'REVIEWED_FOR_SUBMISSION','uploadSigned':signed,
        'bundleSha256':hashlib.sha256(Path(bundle).read_bytes()).hexdigest() if bundle else None,
        'privacyPolicyUrl':policy or None,'supportEmail':email or None,'blockers':blockers,
        'note':'Automated checks and recorded evidence do not replace Google Play review.'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--config',type=Path,default=REPO/'store/readiness.json');p.add_argument('--bundle',type=Path)
    p.add_argument('--submission',action='store_true');p.add_argument('--output',type=Path)
    args=p.parse_args();config=json.loads(args.config.read_text());report=inspect(config,args.bundle)
    if args.submission and report['privacyPolicyUrl']:
        try:
            with urlopen(Request(report['privacyPolicyUrl'],headers={'User-Agent':'Akhlaq-release-check'}),timeout=20) as response:
                page=response.read(2_000_000).decode('utf-8')
                assert response.status==200 and response.headers.get_content_type()=='text/html'
                assert response.geturl().startswith('https://')
                assert 'Akhlaq privacy policy' in page and 'Retention and deletion' in page
        except Exception as error:
            report['blockers'].append('Public privacy page verification failed: '+str(error))
    if report['blockers']:report['status']='BLOCKED'
    body=json.dumps(report,indent=2)+'\n'
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(body)
    print(body)
    if args.submission and report['blockers']:return 1
    return 0
if __name__=='__main__':sys.exit(main())
