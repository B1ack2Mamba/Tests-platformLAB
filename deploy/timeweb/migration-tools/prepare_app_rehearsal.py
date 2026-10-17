"""Prepare build-only rehearsal settings without changing the live deployment."""
from pathlib import Path
import json
import os
import re
import socket
import subprocess

BASE=Path('/opt/kadrlab')
APP=BASE/'app'

def main():
    if os.geteuid()!=0 or socket.gethostname()!='kadrlab-ru':
        raise RuntimeError('Only the new migration host is allowed')
    os.umask(0o077)
    destination=APP/'.env.timeweb.local'
    if destination.exists():
        raise RuntimeError('Existing application configuration must not be overwritten')
    source={}
    for line in (BASE/'supabase-runtime/.env').read_text().splitlines():
        key,sep,value=line.partition('=')
        if sep and not key.startswith('#'):
            source[key]=value.strip().strip('"').strip("'")
    for name in ('ANON_KEY','SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY'):
        if len(source.get(name,''))<24 or not re.fullmatch(r'[A-Za-z0-9_.-]+',source[name]):
            raise RuntimeError('Unexpected generated Supabase key format')
    key=(BASE/'secrets/timeweb-ai-key').read_text().strip()
    if len(key)<20 or any(c.isspace() for c in key):
        raise RuntimeError('The approved gateway key is missing')
    admin_source=(APP/'lib/admin.ts').read_text()
    matched=re.search(r'const fallbackAdmins = (\[[^;]+\]);',admin_source)
    if not matched:
        raise RuntimeError('Existing administrator configuration was not found')
    admins=json.loads(matched.group(1))
    if not admins or not all(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',a) for a in admins):
        raise RuntimeError('Unexpected existing administrator list')
    domain='www.xn--80aaachl0aqe6abetcez8t.xn--p1ai'
    api='api.xn--80aaachl0aqe6abetcez8t.xn--p1ai'
    origin='https://'+domain
    env={
        'APP_DOMAIN':domain,'APP_REDIRECT_DOMAIN':domain.removeprefix('www.'),
        'SUPABASE_DOMAIN':api,'ACME_EMAIL':admins[0],'APP_IMAGE_TAG':'timeweb-rehearsal',
        'APP_URL':origin,'APP_BASE_URL':origin,'NEXT_PUBLIC_APP_URL':origin,
        'NEXT_PUBLIC_SITE_URL':origin,'NEXT_PUBLIC_INVITE_BASE_URL':origin,
        'NEXT_PUBLIC_SUPABASE_URL':'https://'+api,
        'NEXT_PUBLIC_SUPABASE_ANON_KEY':source['ANON_KEY'],
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':source['SUPABASE_PUBLISHABLE_KEY'],
        'SUPABASE_SERVICE_ROLE_KEY':source['SERVICE_ROLE_KEY'],
        'SUPABASE_PROJECT_REGION':'ru','NEXT_PUBLIC_SUPABASE_PROJECT_REGION':'ru',
        'APP_SERVER_PROVIDER':'Timeweb Cloud','APP_SERVER_REGION':'MSK-1',
        'APP_SERVER_CITY':'Moscow','APP_SERVER_COUNTRY':'Russia',
        'OPENAI_PROVIDER':'timeweb','TIMEWEB_AI_API_KEY':key,
        'TIMEWEB_AI_MODEL_MAP':json.dumps({'gpt-5.6-terra':'openai/gpt-5.6-terra','gpt-5.6-sol':'openai/gpt-5.6-sol'},separators=(',',':')),
        'OPENAI_TEST_MODEL':'gpt-5.6-terra','OPENAI_PREMIUM_MODEL':'gpt-5.6-terra',
        'OPENAI_FINAL_MODEL':'gpt-5.6-sol','OPENAI_AI_PLUS_MODEL':'gpt-5.6-sol',
        'NEXT_PUBLIC_ADMIN_EMAILS':','.join(admins),
        'NEXT_PUBLIC_ENABLE_PWA':'0','NEXT_PUBLIC_EMAIL_RECOVERY_ENABLED':'0',
        'PAYMENTS_ENABLED':'0','NEXT_PUBLIC_PAYMENTS_ENABLED':'0',
        'NEXT_PUBLIC_YOOKASSA_TEST_UI_ENABLED':'0',
    }
    with destination.open('x') as output:
        output.write('# PRIVATE REHEARSAL. DNS and production integrations are not switched.\n')
        for name,value in env.items():
            if any(c in value for c in ("'", '\n', '\r', '\x00')):
                raise RuntimeError('Unsupported character in generated environment value')
            output.write(name+"='"+value+"'\n")
    destination.chmod(0o600)
    subprocess.run(['docker','compose','--env-file',str(destination),'-f',str(APP/'deploy/timeweb/docker-compose.yml'),'config','--quiet'],check=True)
    print(json.dumps({'rehearsal_configuration_ready':True,'file_mode':'0600',
        'payments_enabled':False,'email_delivery_enabled':False,'production_cutover':False,
        'legacy_payment_credentials_copied':False,'public_urls_require_dns':True}))

if __name__=='__main__':
    main()
