"""Restore permissions only on tracked public upstream files, never env or data."""
from pathlib import Path
import os
import subprocess

base=Path('/opt/kadrlab')
source=base/'supabase-source'
runtime=base/'supabase-runtime'
tracked=subprocess.run(['git','-C',str(source),'ls-files','-s','-z','--','docker/'],capture_output=True,check=True).stdout.decode().split('\0')
count=0
for entry in tracked:
    if not entry:
        continue
    metadata,path=entry.split('\t',1)
    relative=Path(path).relative_to('docker')
    if relative.parts[:3]==('volumes','db','data') or relative.name=='.env' or relative.name.startswith('.env.') and relative.name!='.env.example':
        continue
    file=runtime/relative
    if file.is_symlink() or not file.is_file():
        continue
    if not file.resolve().is_relative_to(runtime.resolve()):
        raise RuntimeError('Unexpected path')
    mode=metadata.split()[0]
    if mode not in ('100644','100755'):
        raise RuntimeError('Unexpected tracked file type')
    file.chmod(0o755 if mode=='100755' else 0o644)
    parent=file.parent
    while parent!=runtime:
        parent.chmod(0o755)
        parent=parent.parent
    count+=1
for file in runtime.glob('.env*'):
    if file.name!='.env.example':
        file.chmod(0o600)
print('Public runtime files repaired:',count,'; private env and database data excluded')
