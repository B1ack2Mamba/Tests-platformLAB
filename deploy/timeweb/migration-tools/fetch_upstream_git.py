"""Fetch the same hash-pinned export rules through the official Git endpoint."""
from pathlib import Path
from urllib.parse import urlparse
import hashlib
import json
import subprocess

HERE=Path(__file__).resolve().parent
SOURCE=Path('/opt/kadrlab/supabase-cli-source')
manifest=json.loads((HERE/'upstream.json').read_text())
revision=subprocess.run(['git','-C',str(SOURCE),'describe','--tags','--exact-match'],capture_output=True,text=True,check=True).stdout.strip()
if revision != manifest['version']:
    raise RuntimeError('Unexpected Supabase CLI tag')
for item in manifest['files']:
    url=urlparse(item['url'])
    prefix='/supabase/cli/'+manifest['version']+'/'
    if url.scheme!='https' or url.netloc!='raw.githubusercontent.com' or not url.path.startswith(prefix):
        raise RuntimeError('Unexpected upstream URL')
    relative=url.path[len(prefix):]
    data=subprocess.run(['git','-C',str(SOURCE),'show','HEAD:'+relative],capture_output=True,check=True,timeout=120).stdout.replace(b'\r\n',b'\n')
    if hashlib.sha256(data).hexdigest()!=item['sha256']:
        raise RuntimeError('Upstream hash mismatch: '+item['name'])
    (HERE/item['name']).write_bytes(data)
print(json.dumps({'upstream_version':revision,'verified_files':len(manifest['files']),'transport':'official_git'}))
