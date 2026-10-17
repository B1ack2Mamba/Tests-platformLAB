"""Store the approved gateway key privately; check only the free model catalogue."""
from datetime import datetime,timezone
from pathlib import Path
import getpass
import json
import os
import socket
import urllib.request
import urllib.error

if os.geteuid()!=0 or socket.gethostname()!='kadrlab-ru':
    raise RuntimeError('Only the migration host is allowed')
os.umask(0o077)
private=Path('/opt/kadrlab/secrets')
file=private/'timeweb-ai-key'
if file.exists():
    key=file.read_text().strip()
else:
    key=getpass.getpass('Timeweb AI Gateway key (hidden): ')
    if not 16<=len(key)<=4096 or any(c.isspace() for c in key):
        raise RuntimeError('Invalid key format')
    with file.open('x') as handle:
        handle.write(key+'\n')
    file.chmod(0o600)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None
report={'checked_utc':datetime.now(timezone.utc).isoformat(),'from_server':'kadrlab-ru','generation_executed':False}
try:
    request=urllib.request.Request('https://api.timeweb.ai/v1/models',headers={'Authorization':'Bearer '+key,'User-Agent':'kadrlab-readonly-check'})
    with urllib.request.build_opener(NoRedirect).open(request,timeout=25) as response:
        payload=json.load(response)
        report['http_status']=response.status
    ids={entry['id'] for entry in payload.get('data',[]) if isinstance(entry,dict) and 'id' in entry}
    report['required_models_available']={name:name in ids for name in ('openai/gpt-5.6-terra','openai/gpt-5.6-sol')}
    report['catalogue_check_passed']=all(report['required_models_available'].values())
except urllib.error.HTTPError as error:
    report.update(catalogue_check_passed=False,http_status=error.code)
except Exception as error:
    report.update(catalogue_check_passed=False,error_type=type(error).__name__)
key=None
(private/'timeweb-ai-model-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
