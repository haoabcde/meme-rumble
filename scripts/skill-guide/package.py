"""Package the two-character handoff and verify a clean extraction."""
from pathlib import Path
import hashlib, json, zipfile

root = Path(__file__).resolve().parents[2]
name = '大肥鱼与奶蛙角色交付_20261126'
source = root / 'deliverables' / name
archive = root / 'deliverables' / (name + '_高清.zip')
data = json.loads((source / '技能清单.json').read_text('utf-8'))
cards = [s for c in data['characters'] for s in c['skills']]
assert [c['id'] for c in data['characters']] == ['whale', 'frog']
assert len(cards) == 26
assert all(s['recording']['width'] == 1920 for s in cards)
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z:
    for path in sorted(source.rglob('*')):
        if path.is_file():
            z.write(path, name + '/' + path.relative_to(source).as_posix())
destination = root / 'output' / '技能说明交付_解压验收' / name
destination.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for entry in z.infolist():
        target = (destination.parent / entry.filename).resolve()
        assert target.is_relative_to(destination.parent.resolve())
    z.extractall(destination.parent)
extracted = json.loads((destination / '技能清单.json').read_text('utf-8'))
assert extracted == data
audit = json.loads((destination / '录制与文件校验.json').read_text('utf-8'))
for card in cards:
    path = destination / card['video']
    reference = next(c for c in audit['clips'] if c['id'] == card['id'])
    assert hashlib.sha256(path.read_bytes()).hexdigest() == reference['sha256']
    assert (destination / card['poster']).stat().st_size > 1000
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.sha256.txt').write_text(checksum + '  ' + archive.name + '\n', 'utf-8')
print(json.dumps({'zip': str(archive), 'bytes': archive.stat().st_size,
                  'sha256': checksum, 'characters': 2, 'clips': len(cards),
                  'cleanExtractionVerified': True, 'extracted': str(destination)}, ensure_ascii=False))
