"""Fetch pinned official export rules, without executing downloaded source."""
from pathlib import Path
import hashlib
import json
import urllib.request

here=Path(__file__).resolve().parent
manifest=json.loads((here/'upstream.json').read_text())
for item in manifest['files']:
    path=here/item['name']
    if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']:
        continue
    request=urllib.request.Request(item['url'],headers={'User-Agent':'kadrlab-migration'})
    with urllib.request.urlopen(request,timeout=30) as response:
        data=response.read()
    data=data.replace(b'\r\n',b'\n')
    if hashlib.sha256(data).hexdigest()!=item['sha256']:
        raise RuntimeError('Upstream hash mismatch: '+item['name'])
    path.write_bytes(data)
print(json.dumps({'upstream_version':manifest['version'],'verified_files':len(manifest['files'])}))
