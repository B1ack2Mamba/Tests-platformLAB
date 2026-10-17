"""Restore only into the empty migration database, and verify every imported table."""
from pathlib import Path
import ast
import hashlib
import json
import os
import re
import socket
import subprocess
import sys

BASE=Path('/opt/kadrlab')
RUNTIME=BASE/'supabase-runtime'

def quote(name):
    return '"'+name.replace('"','""')+'"'

def query(sql):
    result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
        input="SET TIMEZONE TO 'UTC';\n"+sql,text=True,capture_output=True,timeout=120)
    if result.returncode:
        raise RuntimeError('Target inspection query failed')
    return json.loads(result.stdout.strip())

def main():
    if os.geteuid()!=0 or socket.gethostname()!='kadrlab-ru':
        raise RuntimeError('Only the new migration host is allowed')
    os.umask(0o077)
    folder=Path(sys.argv[1]).resolve()
    if folder.parent!=BASE/'backups' or not re.fullmatch(r'source-backup-\d{8}T\d{6}Z',folder.name):
        raise RuntimeError('Unexpected backup directory')
    manifest=json.loads((folder/'manifest.json').read_text())
    if manifest['source_project']!='jzpgxxmssyjplgzchjvi' or manifest.get('read_only')!='on':
        raise RuntimeError('Unexpected source snapshot')
    for item in manifest['files']:
        file=folder/item['file']
        if file.parent!=folder or hashlib.sha256(file.read_bytes()).hexdigest()!=item['sha256']:
            raise RuntimeError('Backup checksum mismatch')
    audit=json.loads((folder/'source-audit.json').read_text())
    if not audit.get('columns'):
        raise RuntimeError('Source column audit required')
    inspection=json.loads(subprocess.run(['docker','inspect','supabase-db'],capture_output=True,text=True,check=True).stdout)[0]
    if inspection['Config']['Image']!='supabase/postgres:17.6.1.136' or inspection['Config']['Labels'].get('com.docker.compose.project.working_dir')!=str(RUNTIME):
        raise RuntimeError('Unexpected target database container')
    state=query("select json_build_object('users',(select count(*) from auth.users),'public_tables',(select count(*) from pg_tables where schemaname='public')); ")
    if state!={'users':0,'public_tables':0}:
        raise RuntimeError('Target is not empty; refusing to overwrite it')
    target_columns=query("select coalesce(json_agg(q),'[]') from (select table_schema as schema_name,table_name,column_name,udt_name from information_schema.columns where table_schema in ('auth','storage') order by 1,2,ordinal_position) q;")
    target={(r['schema_name'],r['table_name'],r['column_name']):r for r in target_columns}
    missing=[]
    skipped={('auth','schema_migrations'),('storage','migrations')}
    for r in audit['columns']:
        key=(r['schema_name'],r['table_name'],r['column_name'])
        if key[0] in ('auth','storage') and key[:2] not in skipped and key not in target:
            missing.append('.'.join(key))
    (folder/'target-preflight.json').write_text(json.dumps({'state':state,'missing_columns':missing},indent=2)+'\n')
    if missing:
        print(json.dumps({'stage':'compatibility_check','missing_columns':missing}))
        raise RuntimeError('Resolve target schema compatibility before import')
    compose=['docker','compose','--env-file','.env','-f','docker-compose.yml','-f',str(BASE/'app/deploy/timeweb/supabase.override.yml')]
    # Pause only this new rehearsal's services, so migrations cannot race the restore.
    services=json.loads(subprocess.run(compose+['config','--format','json'],cwd=RUNTIME,capture_output=True,text=True,check=True).stdout)['services']
    subprocess.run(compose+['stop']+[name for name in services if name!='db'],cwd=RUNTIME,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    combined=folder/'restore-input.sql'
    with combined.open('xb') as out:
        out.write(b'SET session_replication_role = replica;\n')
        for name in ('roles.sql','schema.sql','data.sql','custom-auth-storage-triggers.sql'):
            out.write((folder/name).read_bytes())
            out.write(b'\n')
        out.write(b'SET session_replication_role = origin;\n')
    with combined.open('rb') as inp,(folder/'restore.stdout.log').open('xb') as out,(folder/'restore.stderr.log').open('xb') as err:
        result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','--single-transaction'],stdin=inp,stdout=out,stderr=err,timeout=240)
    if result.returncode:
        raise RuntimeError('Restore transaction failed; private diagnostics retained, services paused')
    columns={}
    for row in audit['columns']:
        columns.setdefault((row['schema_name'],row['table_name']),[]).append(row['column_name'])
    statements=[]
    for table in audit['tables']:
        key=(table['schema'],table['table'])
        if key in skipped:
            continue
        fields=','.join(map(quote,columns[key]))
        # The source projection tolerates additional columns in newer Auth/Storage.
        statements.append("select '"+key[0]+"' as schema_name,'"+key[1]+"' as table_name,count(*)::bigint as rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as content_hash from (select "+fields+' from '+quote(key[0])+'.'+quote(key[1])+') t')
    actual=query("select json_agg(q) from ("+' union all '.join(statements)+') q;')
    mapping={(t['schema_name'],t['table_name']):t for t in actual}
    mismatches=[]
    for expected in audit['tables']:
        key=(expected['schema'],expected['table'])
        if key in skipped:
            continue
        got=mapping[key]
        if got['rows']!=expected['rows'] or got['content_hash']!=expected['content_hash']:
            mismatches.append('.'.join(key))
    target_sequences=query("select coalesce(json_agg(q),'[]') from (select schemaname,sequencename,start_value,min_value,max_value,increment_by,cycle,last_value from pg_sequences where schemaname in ('public','auth','storage') order by 1,2) q;")
    if target_sequences!=audit['sequences']:
        mismatches.append('sequence_state')
    module=ast.parse((Path(__file__).parent/'export_source_database.py').read_text())
    audit_function=next(n for n in module.body if isinstance(n,ast.FunctionDef) and n.name=='audit')
    query_node=next(n.value for n in audit_function.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='queries' for t in n.targets))
    checks=ast.literal_eval(query_node)
    schema_results={}
    for name in ('rls','policies','indexes','functions','grants','custom_auth_storage_triggers'):
        metadata=query("select coalesce(json_agg(q),'[]') from ("+checks[name]+') q;')
        schema_results[name]={'matches':metadata==audit[name],'source_items':len(audit[name]),'target_items':len(metadata)}
        if metadata!=audit[name]:
            mismatches.append(name)
    (folder/'schema-validation.json').write_text(json.dumps(schema_results,indent=2)+'\n')
    report={'import_transaction_committed':True,'verified_tables':len(actual),'rows':sum(t['rows'] for t in actual),
        'all_imported_row_counts_and_hashes_match':not mismatches,'mismatches':mismatches,
        'excluded_provider_migration_tables':['auth.schema_migrations','storage.migrations'],
        'production_cutover':False,'services_paused':True}
    (folder/'restore-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    if mismatches:
        raise RuntimeError('Restored data mismatch; keep rehearsal isolated')

if __name__=='__main__':
    main()
