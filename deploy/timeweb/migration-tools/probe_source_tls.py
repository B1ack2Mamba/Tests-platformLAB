"""Bounded source connectivity probe: no database credentials or queries."""
from pathlib import Path
import json
import socket
import ssl
import struct
import time

host='aws-1-eu-west-1.pooler.supabase.com'
addresses=sorted({item[4][0] for item in socket.getaddrinfo(host,5432,socket.AF_INET,socket.SOCK_STREAM)})
context=ssl.create_default_context(cafile=str(Path(__file__).parent/'supabase-prod-ca-2021.crt'))
for address in addresses[:3]:
    started=time.monotonic()
    result={'ip':address,'stage':'tcp','credentials_sent':False}
    connection=None
    try:
        connection=socket.create_connection((address,5432),timeout=7)
        result['stage']='postgres_ssl_request'
        connection.sendall(struct.pack('!II',8,80877103))
        reply=connection.recv(1)
        if reply!=b'S':
            raise RuntimeError('TLS negotiation was not accepted')
        result['stage']='verified_tls'
        connection=context.wrap_socket(connection,server_hostname=host)
        result.update(tls_version=connection.version(),verified_tls=True)
    except Exception as error:
        result.update(verified_tls=False,error_type=type(error).__name__)
    finally:
        if connection:
            connection.close()
    result['elapsed_seconds']=round(time.monotonic()-started,2)
    print(json.dumps(result),flush=True)
