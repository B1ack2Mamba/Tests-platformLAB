"""Prepare a new, loopback-only Supabase rehearsal; never replace an existing env."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys

BASE = Path('/opt/kadrlab')
SOURCE = BASE/'supabase-source'
RUNTIME = BASE/'supabase-runtime'
COMMIT = '564eab8ad7840b13324f68b1bfac074ef8d51c21'
OVERRIDE = BASE/'app/deploy/timeweb/supabase.override.yml'

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def main():
    if os.geteuid() != 0 or socket.gethostname() != 'kadrlab-ru':
        raise RuntimeError('This preparation is restricted to the new migration host')
    os.umask(0o077)
    revision=run(['git','-C',str(SOURCE),'rev-parse','HEAD'],capture_output=True,text=True).stdout.strip()
    if revision != COMMIT:
        raise RuntimeError('Unexpected upstream revision')
    RUNTIME.mkdir(exist_ok=True)
    if any(RUNTIME.iterdir()):
        raise RuntimeError('Runtime is not empty; refusing to replace configuration or data')
    shutil.copytree(SOURCE/'docker',RUNTIME,dirs_exist_ok=True)
    run([sys.executable,str(Path(__file__).with_name('repair_public_runtime_permissions.py'))],stdout=subprocess.DEVNULL)
    shutil.copyfile(RUNTIME/'.env.example',RUNTIME/'.env')
    (RUNTIME/'.env').chmod(0o600)
    private=BASE/'secrets'
    private.mkdir(mode=0o700,exist_ok=True)
    # The official tools print new secrets, so their entire output stays private.
    for script in ('generate-keys.sh','add-new-auth-keys.sh'):
        with (private/(script+'.log')).open('xb') as log:
            run(['sh','utils/'+script,'--update-env'],cwd=RUNTIME,stdout=log,stderr=log,timeout=240)
    changes={
        'SUPABASE_PUBLIC_URL':'http://127.0.0.1:8000',
        'API_EXTERNAL_URL':'http://127.0.0.1:8000/auth/v1',
        'SITE_URL':'http://127.0.0.1:3000',
        'ADDITIONAL_REDIRECT_URLS':'',
        'ENABLE_EMAIL_SIGNUP':'true','ENABLE_EMAIL_AUTOCONFIRM':'true',
        'ENABLE_PHONE_SIGNUP':'false','ENABLE_PHONE_AUTOCONFIRM':'false',
        'SMTP_ADMIN_EMAIL':'','SMTP_HOST':'','SMTP_PORT':'587',
        'SMTP_USER':'','SMTP_PASS':'','SMTP_SENDER_NAME':'',
        'OPENAI_API_KEY':'','POOLER_TENANT_ID':'kadrlab-ru',
        'STUDIO_DEFAULT_ORGANIZATION':'Kadrlab','STUDIO_DEFAULT_PROJECT':'Migration rehearsal',
    }
    env_path=RUNTIME/'.env'
    lines=env_path.read_text().splitlines()
    present=set()
    for i,line in enumerate(lines):
        key,sep,_=line.partition('=')
        if sep and key in changes:
            lines[i]=key+'='+changes[key]
            present.add(key)
    lines.extend(k+'='+v for k,v in changes.items() if k not in present)
    env_path.write_text('\n'.join(lines)+'\n')
    env_path.chmod(0o600)
    env={line.split('=',1)[0]:line.split('=',1)[1] for line in lines if '=' in line and not line.startswith('#')}
    for key in ('POSTGRES_PASSWORD','DASHBOARD_PASSWORD','JWT_SECRET','SERVICE_ROLE_KEY','ANON_KEY','SUPABASE_SECRET_KEY','JWT_KEYS'):
        if len(env.get(key,''))<24 or 'your-super' in env[key] or 'insecure' in env[key]:
            raise RuntimeError('Generated credential validation failed: '+key)
    for file in RUNTIME.glob('.env*'):
        file.chmod(0o600)
    network=run(['docker','network','ls','--filter','name=^kadrlab-data$','--format','{{.Name}}'],capture_output=True,text=True).stdout.strip()
    if network != 'kadrlab-data':
        run(['docker','network','create','kadrlab-data'],stdout=subprocess.DEVNULL)
    command=['docker','compose','--env-file','.env','-f','docker-compose.yml','-f',str(OVERRIDE)]
    config=json.loads(run(command+['config','--format','json'],cwd=RUNTIME,capture_output=True,text=True).stdout)
    ports=[]
    for name,service in config['services'].items():
        for binding in service.get('ports',[]):
            if binding.get('host_ip')!='127.0.0.1':
                raise RuntimeError('Unexpected public service port: '+name)
            ports.append({'service':name,'host_ip':binding['host_ip'],'published':binding['published']})
    result={'upstream_ref':'self-hosted/v0.8.2','upstream_commit':COMMIT,
            'services':len(config['services']),'bindings':ports,'email_delivery':False,
            'started':False,'env_mode':'0600'}
    (RUNTIME/'.supabase-version').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

if __name__=='__main__':
    main()
