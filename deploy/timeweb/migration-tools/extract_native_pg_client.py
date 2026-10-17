"""Extract official PG17 client binaries to compare native vs container transport."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

root=Path('/opt/kadrlab/pg-client')
if root.exists():
    raise RuntimeError('Client directory already exists')
os.umask(0o077)
(root/'bin').mkdir(parents=True)
(root/'lib').mkdir()
image='supabase/postgres:17.6.1.136'
container=subprocess.run(['docker','create','--entrypoint','/bin/true',image],capture_output=True,text=True,check=True).stdout.strip()
if not container or len(container)!=64 or any(c not in '0123456789abcdef' for c in container):
    raise RuntimeError('Unexpected temporary container identifier')
try:
    for name in ('pg_dump','pg_dumpall','pg_restore'):
        subprocess.run(['docker','cp',container+':/usr/lib/postgresql/17/bin/'+name,str(root/'bin'/name)],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['docker','cp','-L',container+':/usr/lib/x86_64-linux-gnu/libpq.so.5',str(root/'lib/libpq.so.5')],check=True,stdout=subprocess.DEVNULL)
finally:
    subprocess.run(['docker','rm',container],check=True,stdout=subprocess.DEVNULL)
env={**os.environ,'LD_LIBRARY_PATH':str(root/'lib')}
versions={}
for name in ('pg_dump','pg_dumpall','pg_restore'):
    versions[name]=subprocess.run([str(root/'bin'/name),'--version'],env=env,capture_output=True,text=True,check=True).stdout.strip()
checksums={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
report={'source_image':image,'versions':versions,'sha256':checksums,'source_data_accessed':False}
(root/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'native_clients_ready':True,'versions':versions}))
