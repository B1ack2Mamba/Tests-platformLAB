"""Consistent read-only Supabase export. Secrets never enter command arguments."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import getpass

import psycopg
from psycopg import sql

HERE = Path(__file__).resolve().parent
PRIVATE = Path('/opt/kadrlab/backups')
BIN = HERE/'bin'
BASH = Path('/bin/bash')
HOST = os.environ['SOURCE_DB_HOST']
USER = os.environ['SOURCE_DB_USER']
CA = HERE/'supabase-prod-ca-2021.crt'
TAG = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
DEST = PRIVATE/f'source-backup-{TAG}'

def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle,'sha256').hexdigest()

def array(name):
    source=(HERE/'supabase-cli-pg-dump.env.ts').read_text(encoding='utf-8')
    matched=re.search(r'export const '+name+r': ReadonlyArray<string> = \[(.*?)\];',source,re.S)
    if not matched:
        raise RuntimeError('Official export configuration not found')
    return re.findall(r'^\s*"([^"]+)"',matched.group(1),re.M)

def run_to_file(command, output, env, timeout=180):
    partial=DEST/(output+'.partial')
    errors=DEST/(output+'.stderr.log')
    with partial.open('xb') as out, errors.open('xb') as err:
        result=subprocess.run(command,env=env,stdout=out,stderr=err,timeout=timeout,check=False)
    if result.returncode:
        raise RuntimeError(f'{output}: export failed ({result.returncode}); diagnostic retained privately')
    final=DEST/output
    partial.rename(final)
    return {'file':output,'bytes':final.stat().st_size,'sha256':digest(final),'stderr_bytes':errors.stat().st_size}

def rows(cursor, query):
    cursor.execute(query)
    names=[d.name for d in cursor.description]
    return [dict(zip(names,row)) for row in cursor.fetchall()]

def audit(cursor):
    result={'tables':[]}
    tables=rows(cursor,"select schemaname, tablename from pg_tables where schemaname in ('public','auth','storage') order by 1,2")
    statements=[]
    for table in tables:
        schema,name=table['schemaname'],table['tablename']
        statements.append(sql.SQL("select {} as schema_name,{} as table_name,count(*)::bigint,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from {}.{} t").format(sql.Literal(schema),sql.Literal(name),sql.Identifier(schema),sql.Identifier(name)))
    cursor.execute(sql.SQL(' union all ').join(statements))
    for schema,name,count,content_hash in cursor.fetchall():
        result['tables'].append({'schema':schema,'table':name,'rows':count,'content_hash':content_hash})
    queries={
      'columns':"select table_schema as schema_name,table_name,column_name,udt_name from information_schema.columns where table_schema in ('public','auth','storage') order by table_schema,table_name,ordinal_position",
      'sequences':"select schemaname,sequencename,start_value,min_value,max_value,increment_by,cycle,last_value from pg_sequences where schemaname in ('public','auth','storage') order by 1,2",
      'extensions':"select extname,extversion from pg_extension order by extname",
      'rls':"select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by c.relname",
      'policies':"select schemaname,tablename,policyname,roles,cmd,md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) as definition_hash from pg_policies where schemaname='public' order by tablename,policyname",
      'indexes':"select tablename,indexname,md5(indexdef) as definition_hash from pg_indexes where schemaname='public' order by tablename,indexname",
      'functions':"select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef,md5(pg_get_functiondef(p.oid)) as definition_hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by 1,2",
      'grants':"select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') order by 1,2,3",
      'wallets':"select count(*) as wallets,coalesce(sum(balance_kopeks),0) as total_balance_kopeks from public.wallets",
      'ledger':"select count(*) as entries,coalesce(sum(amount_kopeks),0) as total_amount_kopeks from public.wallet_ledger",
      'duplicate_payment_references':"select count(*) as count from (select user_id,ref from public.wallet_ledger where ref is not null group by user_id,ref having count(*)>1) d",
      'custom_auth_storage_triggers':"select n.nspname as schema_name,c.relname as table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where not t.tgisinternal and n.nspname in ('auth','storage') and pn.nspname='public' order by 1,2,3",
    }
    for name,query in queries.items():
        result[name]=rows(cursor,query)
    return result

def check_copy_counts(path, expected):
    actual={}
    active=None
    with path.open(encoding='utf-8') as handle:
        for line in handle:
            if active is not None:
                if line.rstrip('\r\n')=='\\.':
                    active=None
                else:
                    actual[active]+=1
            elif match:=re.match(r'^COPY "([^"]+)"\."([^"]+)" .* FROM stdin;$',line.rstrip('\r\n')):
                active=(match[1],match[2])
                if active in actual:
                    raise RuntimeError('Duplicate COPY table in data export')
                actual[active]=0
    if active is not None:
        raise RuntimeError('Incomplete COPY section')
    skipped={('auth','schema_migrations'),('storage','migrations')}
    for table in expected:
        key=(table['schema'],table['table'])
        if key not in skipped and actual.get(key)!=table['rows']:
            raise RuntimeError('Data export table count differs from the source snapshot: '+'.'.join(key))
    return {'copy_tables':len(actual),'copy_rows':sum(actual.values()),'all_source_table_counts_match':True}

def main():
    if not (BIN/'pg_dump').exists():
        raise RuntimeError('Official PostgreSQL tools are not ready')
    version=subprocess.run([str(BIN/'pg_dump'),'--version'],capture_output=True,text=True,check=True).stdout.strip()
    if not re.search(r'PostgreSQL\) 17\.', version):
        raise RuntimeError('Unexpected pg_dump version')
    if os.geteuid() != 0:
        raise RuntimeError('Run on the target server as root')
    os.umask(0o077)
    PRIVATE.mkdir(mode=0o700,exist_ok=True)
    DEST.mkdir(mode=0o700,exist_ok=False)
    password=getpass.getpass('Source database password (hidden): ')
    if not password:
        raise RuntimeError('Source database password is empty')
    env=os.environ.copy()
    for key in ('PGSERVICE','PGSERVICEFILE','PGPASSFILE','BASH_ENV','ENV','SHELLOPTS','BASHOPTS','EXTRA_FLAGS','EXTRA_SED'):
        env.pop(key,None)
    env.update(PGHOST=HOST,PGPORT='5432',PGUSER=USER,PGDATABASE='postgres',PGPASSWORD=password,
        PGSSLMODE='verify-full',PGSSLROOTCERT=str(CA),PGCONNECT_TIMEOUT='15',PGGSSENCMODE='disable',
        PGAPPNAME='kadrlab_readonly_backup',PGCLIENTENCODING='UTF8',
        PATH=str(BIN)+os.pathsep+env.get('PATH',''),
        LC_ALL='C',KADRLAB_BACKUP_DEST=str(DEST))
    manifest={'started_utc':TAG,'source_project':USER.removeprefix('postgres.'),'tls':'verify-full',
        'tool':version,'official_supabase_cli_rules':'v2.121.0','files':[],
        'restoration_tested':False,'production_cutover':False}
    for filename in ('supabase-cli-dump_role.sh','supabase-cli-dump_schema.sh','supabase-cli-dump_data.sh','supabase-cli-pg-dump.env.ts'):
        manifest.setdefault('export_rule_hashes',{})[filename]=digest(HERE/filename)
    with psycopg.connect(host=HOST,port=5432,user=USER,dbname='postgres',password=password,
            sslmode='verify-full',sslrootcert=str(CA),connect_timeout=15,gssencmode='disable',
            application_name='kadrlab_readonly_backup_snapshot') as connection:
        env['PGHOSTADDR']=connection.info.hostaddr
        manifest['source_hostaddr']=connection.info.hostaddr
        connection.isolation_level=psycopg.IsolationLevel.REPEATABLE_READ
        connection.read_only=True
        with connection.cursor() as cursor:
            cursor.execute("set local statement_timeout = '120s'")
            cursor.execute("set local timezone = 'UTC'")
            cursor.execute("select current_setting('transaction_read_only'),pg_export_snapshot(),current_setting('server_version')")
            readonly,snapshot,pg_version=cursor.fetchone()
            if readonly!='on' or not re.fullmatch(r'[0-9A-Fa-f-]+',snapshot):
                raise RuntimeError('Read-only shared snapshot not established')
            manifest.update(read_only=readonly,source_postgres=pg_version,shared_snapshot=snapshot)
            source_audit=audit(cursor)
            audit_path=DEST/'source-audit.json'
            audit_path.write_text(json.dumps(source_audit,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
            manifest['files'].append({'file':audit_path.name,'bytes':audit_path.stat().st_size,'sha256':digest(audit_path)})
            supplemental=[]
            for trigger in source_audit['custom_auth_storage_triggers']:
                statement=trigger['definition'].replace('CREATE TRIGGER ','CREATE OR REPLACE TRIGGER ',1)
                supplemental.append(statement+';')
                if trigger['tgenabled']!='O':
                    mode={'D':'DISABLE','A':'ENABLE ALWAYS','R':'ENABLE REPLICA'}[trigger['tgenabled']]
                    quote=lambda value:'"'+value.replace('"','""')+'"'
                    supplemental.append('ALTER TABLE '+quote(trigger['schema_name'])+'.'+quote(trigger['table_name'])+' '+mode+' TRIGGER '+quote(trigger['tgname'])+';')
            supplemental_path=DEST/'custom-auth-storage-triggers.sql'
            supplemental_path.write_text('-- Restore after application schema; source custom triggers using public functions.\n'+'\n'.join(supplemental)+'\n',encoding='utf-8')
            manifest['files'].append({'file':supplemental_path.name,'bytes':supplemental_path.stat().st_size,'sha256':digest(supplemental_path),'custom_triggers':len(source_audit['custom_auth_storage_triggers'])})
            print(json.dumps({'stage':'source_audit_complete','tables':len(source_audit['tables'])}),flush=True)
            for kind,filename in (('role','roles.sql'),('schema','schema.sql'),('data','data.sql')):
                settings=env.copy()
                if kind=='role':
                    settings.update(RESERVED_ROLES='|'.join(array('RESERVED_ROLES')),ALLOWED_CONFIGS='|'.join(array('ALLOWED_CONFIGS')),EXTRA_SED='/^--/d')
                else:
                    settings.update(EXCLUDED_SCHEMAS='|'.join(array('INTERNAL_SCHEMAS' if kind=='schema' else 'EXCLUDED_SCHEMAS')),
                        EXTRA_FLAGS=f'--snapshot={snapshot} --lock-wait-timeout=10000',INCLUDED_SCHEMAS='*')
                    if kind=='schema':
                        settings['EXTRA_SED']='/^--/d'
                # Use the full flag name across client implementations.
                upstream=HERE/f'supabase-cli-dump_{kind}.sh'
                portable_script=DEST/f'dump_{kind}.portable.sh'
                portable_script.write_text(upstream.read_text(encoding='utf-8').replace('--quote-all-identifier\n','--quote-all-identifiers\n').replace('--quote-all-identifier \\\n','--quote-all-identifiers \\\n'),encoding='utf-8',newline='\n')
                manifest.setdefault('native_compatibility',{})[kind]={'change':'Expanded --quote-all-identifier to --quote-all-identifiers','script_sha256':digest(portable_script)}
                record=run_to_file([str(BASH),'--noprofile','--norc',str(portable_script)],filename,settings)
                manifest['files'].append(record)
                print(json.dumps({'stage':filename,'bytes':record['bytes']}),flush=True)
            manifest['data_validation']=check_copy_counts(DEST/'data.sql',source_audit['tables'])
            schema=(DEST/'schema.sql').read_text(encoding='utf-8')
            public_tables=sum(t['schema']=='public' for t in source_audit['tables'])
            if len(re.findall(r'^CREATE TABLE IF NOT EXISTS "public"\.',schema,re.M))!=public_tables:
                raise RuntimeError('Public schema table count mismatch')
            # Unfiltered logical archive is retained for recovery, never restored blindly into Supabase.
            record=run_to_file([str(BIN/'pg_dump'),'--format=custom','--role=postgres',
                f'--snapshot={snapshot}','--lock-wait-timeout=10000'], 'complete-source.dump',env)
            record['purpose']='Unfiltered recovery archive; use filtered roles/schema/data for migration'
            manifest['files'].append(record)
            record=run_to_file([str(BIN/'pg_restore'),'--list',str(DEST/'complete-source.dump')],'complete-source.toc.txt',env)
            manifest['files'].append(record)
            cursor.execute("select current_setting('transaction_read_only')")
            if cursor.fetchone()[0]!='on':
                raise RuntimeError('Source audit transaction is no longer read-only')
    env.pop('PGPASSWORD',None)
    password = None
    manifest.update(completed_utc=datetime.now(timezone.utc).isoformat(),export_complete=True)
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    safe={'export_complete':True,'directory':str(DEST),'public_tables':public_tables,
          'auth_users':next(t['rows'] for t in source_audit['tables'] if (t['schema'],t['table'])==('auth','users')),
          'data_validation':manifest['data_validation'],'tls':'verify-full','restoration_tested':False}
    (DEST/'result-summary.json').write_text(json.dumps(safe,indent=2),encoding='utf-8')
    print(json.dumps(safe),flush=True)

if __name__=='__main__':
    try:
        main()
    except Exception as error:
        # PostgreSQL exceptions may contain query data. Save them only inside the protected backup directory.
        if DEST.exists():
            (DEST/'failure.txt').write_text(type(error).__name__+': '+str(error),encoding='utf-8')
        print(json.dumps({'export_complete':False,'error_type':type(error).__name__,'diagnostic_directory':str(DEST)}),flush=True)
        raise SystemExit(1)
