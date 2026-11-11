import hashlib
import json
import re
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
RELEASE = ROOT / 'release'
OFFLINE = RELEASE / '地球现场_离线版'
SOURCE_ARCHIVE = '人教版地理必修一_源工程_20261106.zip'
manifest = json.loads((ROOT / 'docs/verification/current-build.json').read_text(encoding='utf-8'))
digest = lambda data: hashlib.sha256(data).hexdigest()
checks = []

for name, expected in {**manifest['sourceSha256'], **manifest['distSha256']}.items():
    assert digest((ROOT / name).read_bytes()) == expected, f'Manifest mismatch: {name}'
checks.append('Current source and dist match the recorded build hashes')
for name, expected in manifest['distSha256'].items():
    target = OFFLINE / Path(name)
    assert digest(target.read_bytes()) == expected, f'Staged build mismatch: {name}'
checks.append(f"All {manifest['currentDist']['fileCount']} staged webpage files match the production build")

def verify_archive(name, base, prefix):
    archive = RELEASE / name
    with ZipFile(archive) as z:
        entries = [e for e in z.infolist() if not e.is_dir()]
        names = [e.filename.replace('\\', '/') for e in entries]
        assert len(set(names)) == len(names), f'Duplicate ZIP entries: {name}'
        for entry, normalized in zip(entries, names):
            assert normalized.startswith(prefix), f'Unexpected ZIP root: {normalized}'
            local = base / normalized[len(prefix):]
            # zipfile.read also verifies each entry CRC.
            assert local.is_file(), f'Missing workspace file: {normalized}'
            assert digest(z.read(entry)) == digest(local.read_bytes()), f'ZIP mismatch: {normalized}'
        if name == SOURCE_ARCHIVE:
            for required in ['CHECKPOINT.md', 'package-lock.json', 'docs/验收记录.md',
                             'docs/verification/current-build.json', 'scripts/write-delivery-manifest.mjs']:
                assert required in names, f'Missing source artifact: {required}'
            assert all(n in names for n in manifest['sourceSha256']), 'Source file missing from ZIP'
        elif name == '地球现场_静态网站.zip':
            assert len(entries) == manifest['currentDist']['fileCount']
        else:
            assert '地球现场_离线版/runtime/node.exe' in names
            assert '地球现场_离线版/打开地球现场.cmd' in names
            assert all('地球现场_离线版/' + n in names for n in manifest['distSha256'])
    checks.append(f'{name}: all {len(entries)} file hashes and ZIP CRCs match')
    return {'name': name, 'bytes': archive.stat().st_size, 'sha256': digest(archive.read_bytes()), 'fileCount': len(entries)}

archives = [
    verify_archive('地球现场_离线版.zip', OFFLINE, '地球现场_离线版/'),
    verify_archive('地球现场_静态网站.zip', ROOT / 'dist', 'dist/'),
    verify_archive(SOURCE_ARCHIVE, ROOT, ''),
]
served = []
entry = (ROOT / 'dist/index.html').read_text(encoding='utf-8')
entry_assets = re.findall(r'(?:src|href)="(?:\./|/)?(assets/[^"?]+\.(?:js|css))"', entry)
assert any(asset.endswith('.js') for asset in entry_assets), 'No entry JavaScript in production HTML'
assert any(asset.endswith('.css') for asset in entry_assets), 'No entry stylesheet in production HTML'
for relative in ['dist/index.html', *['dist/' + asset for asset in dict.fromkeys(entry_assets)]]:
    with urlopen('http://127.0.0.1:4173/' + relative.removeprefix('dist/'), timeout=15) as response:
        assert digest(response.read()) == manifest['distSha256'][relative], f'Served version mismatch: {relative}'
    served.append(relative)
checks.append('Portable localhost service serves the matching index, JavaScript, and CSS')
receipt = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'checks': checks, 'failures': [],
           'archives': archives, 'servedFiles': served, 'distFiles': manifest['currentDist']['fileCount'],
           'limitations': ['This compares packaged files and the running local service; no fresh Windows installation or physical network disconnection was tested.']}
(RELEASE / '交付一致性.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(RELEASE / '交付文件.sha256.txt').write_text('\n'.join(a['sha256'] + '  ' + a['name'] for a in archives) + '\n', encoding='utf-8')
print(json.dumps({'checks': len(checks), 'failures': 0, 'archives': [{k: a[k] for k in ['name', 'bytes', 'fileCount']} for a in archives]}, ensure_ascii=False))
