"""Print bounded diagnostics without credentials from this fresh Supabase runtime."""
from pathlib import Path
import base64
import hashlib
import hmac
import json
import re
import subprocess

runtime=Path('/opt/kadrlab/supabase-runtime')
env=dict(line.split('=',1) for line in (runtime/'.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
secrets=[v for k,v in env.items() if len(v)>7 and any(s in k for s in ('KEY','PASSWORD','SECRET','TOKEN','PASS'))]
def redact(text):
    for value in sorted(secrets,key=len,reverse=True):
        text=text.replace(value,'[redacted]')
    text=re.sub(r'(postgres(?:ql)?://[^:\s]+:)[^@\s]+@',r'\1[redacted]@',text)
    text=re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[redacted-jwt]',text)
    return text

names=['supabase-db','supabase-auth','supabase-rest','realtime-dev.supabase-realtime','supabase-storage','supabase-edge-functions','supabase-pooler']
for name in names:
    result=subprocess.run(['docker','logs','--tail','3',name],capture_output=True,text=True)
    lines=redact(result.stdout+'\n'+result.stderr).strip().splitlines()
    print(json.dumps({'container':name,'last_log_lines':[line[:550] for line in lines[-3:]]}))
result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],
    input="select json_agg(q) from (select rolname,rolpassword from pg_authid where rolname in ('postgres','supabase_admin','supabase_auth_admin','supabase_storage_admin','authenticator','supabase_replication_admin')) q;",capture_output=True,text=True)
if result.returncode:
    print(json.dumps({'role_check':'query_failed'}))
else:
    checks=[]
    for row in json.loads(result.stdout):
        stored=row['rolpassword'] or ''
        valid=False
        if stored.startswith('SCRAM-SHA-256$'):
            _,parameters,keys=stored.split('$')
            iterations,salt=parameters.split(':')
            stored_key,_=keys.split(':')
            salted=hashlib.pbkdf2_hmac('sha256',env['POSTGRES_PASSWORD'].encode(),base64.b64decode(salt),int(iterations))
            actual=hashlib.sha256(hmac.new(salted,b'Client Key','sha256').digest()).digest()
            valid=hmac.compare_digest(actual,base64.b64decode(stored_key))
        elif stored.startswith('md5'):
            valid=hmac.compare_digest(stored[3:],hashlib.md5((env['POSTGRES_PASSWORD']+row['rolname']).encode()).hexdigest())
        checks.append({'role':row['rolname'],'password_matches_config':valid,'has_password':bool(stored)})
    print(json.dumps({'database_service_roles':checks}))
