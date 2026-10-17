"""Extract official PG17 client binaries to compare native vs container transport."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

root=Path('/opt/kadrlab/pg-client')
if root.exists() and any(p.is_file() for p in root.rglob('*')):
    raise RuntimeError('Client directory already contains files')
os.umask(0o077)
(root/'bin').mkdir(parents=True,exist_ok=True)
(root/'lib').mkdir(exist_ok=True)
image='postgres:17.11-bookworm'
paths=subprocess.run(['docker','run','--rm','--entrypoint','sh',image,'-c','command -v pg_dump; command -v pg_dumpall; command -v pg_restore; ldd "$(command -v pg_dump)"'],capture_output=True,text=True,check=True).stdout.splitlines()
binary_paths=paths[:3]
if not all(path.startswith('/usr/') and ' ' not in path for path in binary_paths):
    raise RuntimeError('Unexpected client binary paths')
libraries={}
host_glibc={'libc.so.6','libm.so.6','libpthread.so.0','libdl.so.2','librt.so.1'}
for line in paths[3:]:
    if '=>' not in line:
        continue
    name,location=line.split('=>',1)
    name=name.strip();location=location.strip().split()[0]
    if name in host_glibc:
        continue
    if not location.startswith(('/usr/lib/','/lib/')) or '/' in name:
        raise RuntimeError('Unexpected client library path')
    libraries[name]=location
if 'libpq.so.5' not in libraries:
    raise RuntimeError('Client library not found')
container=subprocess.run(['docker','create','--entrypoint','/bin/true',image],capture_output=True,text=True,check=True).stdout.strip()
if not container or len(container)!=64 or any(c not in '0123456789abcdef' for c in container):
    raise RuntimeError('Unexpected temporary container identifier')
try:
    for name,path in zip(('pg_dump','pg_dumpall','pg_restore'),binary_paths):
        subprocess.run(['docker','cp','-L',container+':'+path,str(root/'bin'/name)],check=True,stdout=subprocess.DEVNULL)
    for name,path in libraries.items():
        subprocess.run(['docker','cp','-L',container+':'+path,str(root/'lib'/name)],check=True,stdout=subprocess.DEVNULL)
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
