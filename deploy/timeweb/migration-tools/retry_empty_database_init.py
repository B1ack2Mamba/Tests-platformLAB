"""Keep the failed initial cluster as a backup, then initialize the empty rehearsal."""
from datetime import datetime,timezone
from pathlib import Path
import json
import os
import shutil
import socket
import subprocess

base=Path('/opt/kadrlab')
runtime=base/'supabase-runtime'
if os.geteuid()!=0 or socket.gethostname()!='kadrlab-ru':
    raise RuntimeError('Only the new migration host is allowed')
os.umask(0o077)
inspection=json.loads(subprocess.run(['docker','inspect','supabase-db'],capture_output=True,text=True,check=True).stdout)[0]
if inspection['Config']['Image']!='supabase/postgres:17.6.1.136' or inspection['Config']['Labels'].get('com.docker.compose.project.working_dir')!=str(runtime):
    raise RuntimeError('Unexpected database container')
data=runtime/'volumes/db/data'
if data.is_symlink() or data.resolve()!=Path('/opt/kadrlab/supabase-runtime/volumes/db/data') or not (data/'PG_VERSION').exists():
    raise RuntimeError('Unexpected database directory')
sql="select json_build_object('users',(select count(*) from auth.users),'public_tables',(select count(*) from pg_tables where schemaname='public'));"
result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True,check=True)
state=json.loads(result.stdout)
if state!={'users':0,'public_tables':0}:
    raise RuntimeError('Database is not empty; initialization retry refused')
backup=base/'backups'/('failed-empty-init-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
shutil.copyfile(runtime/'.env',backup/'runtime.env')
(backup/'runtime.env').chmod(0o600)
subprocess.run(['docker','cp','supabase-db:/etc/postgresql-custom',str(backup/'postgresql-custom')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
command=['docker','compose','--env-file','.env','-f','docker-compose.yml','-f',str(base/'app/deploy/timeweb/supabase.override.yml')]
with (backup/'container-stop.log').open('xb') as log:
    subprocess.run(command+['down','--timeout','30'],cwd=runtime,stdout=log,stderr=log,check=True,timeout=180)
# No data or Docker volumes are deleted. Keep the failed cluster recoverable.
data.rename(backup/'postgres-data')
with (backup/'container-start.log').open('xb') as log:
    result=subprocess.run(command+['up','-d'],cwd=runtime,stdout=log,stderr=log,timeout=240)
print(json.dumps({'empty_database_verified':state,'previous_cluster_preserved':str(backup),'start_exit':result.returncode}))
raise SystemExit(result.returncode)
