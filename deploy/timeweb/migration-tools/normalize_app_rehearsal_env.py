"""Normalize only the known generated rehearsal env; preserve the original."""
from pathlib import Path
from datetime import datetime,timezone
import json,os,socket,shutil
if os.geteuid()!=0 or socket.gethostname()!='kadrlab-ru':
    raise RuntimeError('Only the new migration host is allowed')
os.umask(0o077)
p=Path('/opt/kadrlab/app/.env.timeweb.local')
raw=p.read_text()
if not raw.startswith('# PRIVATE REHEARSAL.'):
    raise RuntimeError('Not the generated rehearsal configuration')
values={}
for line in raw.splitlines():
    if not line or line.startswith('#'):
        continue
    key,sep,value=line.partition('=')
    if not sep:
        raise RuntimeError('Unexpected env line')
    values[key]=json.loads(value)
if values.get('OPENAI_PROVIDER')!='timeweb' or any(values.get(k)!='0' for k in ('PAYMENTS_ENABLED','NEXT_PUBLIC_PAYMENTS_ENABLED','NEXT_PUBLIC_YOOKASSA_TEST_UI_ENABLED')):
    raise RuntimeError('Only disabled-payment rehearsal config may be normalized')
if any(not isinstance(v,str) or any(c in v for c in ("'",'\n','\r','\x00')) for v in values.values()):
    raise RuntimeError('Unsupported generated value')
backup=Path('/opt/kadrlab/secrets')/('app-env-before-quote-fix-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
with backup.open('xb') as out:
    out.write(raw.encode())
backup.chmod(0o600)
temp=p.with_suffix('.normalized.new')
with temp.open('x') as out:
    out.write(raw.splitlines()[0]+'\n')
    for key,value in values.items():
        out.write(key+"='"+value+"'\n")
temp.chmod(0o600)
temp.replace(p)
print(json.dumps({'env_normalized':True,'credential_values_unchanged':True,'original_preserved':True}))
