"""Controlled audit outage in a disposable Docker project. Restarts audit in finally."""
import argparse
import concurrent.futures
import json
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project',required=True)
parser.add_argument('--url',required=True)
args=parser.parse_args()
base=args.url.rstrip('/')
compose=['docker','compose','-p',args.project]
passed=[]

def docker(*arguments):
    return subprocess.check_output(compose+list(arguments),text=True,stderr=subprocess.STDOUT).strip()

def inspect(service):
    container=docker('ps','-q',service)
    assert container,f'{service} is not running'
    return json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]

front=inspect('frontend-angular')
ports=front['NetworkSettings']['Ports']['80/tcp']
parsed=urlparse(base)
assert parsed.hostname in ('localhost','127.0.0.1') and any(int(p['HostPort'])==(parsed.port or 80) for p in ports),'URL does not identify the selected local Docker frontend'
audit=inspect('ms-auditoria')
audit_port=audit['NetworkSettings']['Ports']['8085/tcp'][0]['HostPort']
audit_url='http://127.0.0.1:'+audit_port
users_url='http://127.0.0.1:'+inspect('ms-usuarios')['NetworkSettings']['Ports']['8081/tcp'][0]['HostPort']
key=docker('exec','-T','ms-cuentas','printenv','INTERNAL_SERVICE_KEY')
assert key

def call(method,path,data=None,token=None,expected=200,operation=None,root=None,headers=None):
    h={'Content-Type':'application/json',**(headers or {})}
    if token: h['Authorization']='Bearer '+token
    if operation: h['Idempotency-Key']=operation
    try:
        with urlopen(Request((root or base)+path,data=None if data is None else json.dumps(data).encode(),headers=h,method=method),timeout=30) as response:
            status=response.status;raw=response.read()
    except HTTPError as error:
        status=error.code;raw=error.read()
    allowed=expected if isinstance(expected,tuple) else (expected,)
    assert status in allowed,f'{method} {path}: {status}: {raw[:200]!r}'
    try: return json.loads(raw) if raw else None
    except json.JSONDecodeError: return raw.decode(errors='replace')

def sql(statement):
    result=subprocess.run(compose+['exec','-T','mysql-db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -B -uroot'],
        input=statement,text=True,check=True,capture_output=True)
    return result.stdout.strip()

def eventually(check,timeout=120):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        try:
            value=check()
            if value: return value
        except (AssertionError,OSError,URLError): pass
        time.sleep(1)
    raise AssertionError('Recovery condition was not reached before the deadline')

def check(name,condition=True):
    assert condition,name
    passed.append(name)
    print('PASS '+name,flush=True)

admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
suffix=uuid.uuid4().hex[:10]
user=call('POST','/api/usuarios/registro',{'email':f'audit-{suffix}@example.test','password':'Prueba123!','nombre':'Prueba','apellido':'Resiliencia'},expected=201)
token=user['token']
call('GET','/api/auditoria',expected=401)
call('GET','/api/auditoria',token=token,expected=403)
check('Audit consultation requires an administrator session')
accounts=[]
for _ in range(2):
    account=call('POST','/api/cuentas',{'usuarioId':user['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},token,201,str(uuid.uuid4()))
    call('PATCH',f"/api/cuentas/{account['id']}/activar",token=admin)
    accounts.append(account)
origin,destination=accounts
call('POST','/api/transacciones',{'numeroCuentaOrigen':origin['numeroCuenta'],'tipoTransaccion':'DEPOSITO','monto':200},token,201,str(uuid.uuid4()))
event={'eventoId':str(uuid.uuid4()),'usuarioEjecutor':'resiliencia-'+suffix,'rolEjecutor':'ADMIN','accion':'PRUEBA_RESILIENCIA',
       'entidadAfectada':'CUENTA','entidadId':origin['id'],'detalles':'Entrega concurrente de demostración','fechaRegistro':datetime.now().isoformat(timespec='microseconds')}
event_headers={'X-Internal-Service':key}
call('POST','/api/auditoria/internal/eventos',event,expected=403,root=audit_url)
call('POST','/api/auditoria/internal/eventos',event,expected=403,root=audit_url,headers={'X-Internal-Service':'incorrecta'})
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(lambda _:call('POST','/api/auditoria/internal/eventos',event,expected=204,root=audit_url,headers=event_headers),range(6)))
filtered='/api/auditoria?usuarioEjecutor=resiliencia-'+suffix+'&accion=PRUEBA_RESILIENCIA'
received=call('GET',filtered,token=admin)
check('Concurrent redelivery persists one immutable audit event',received['totalElements']==1 and received['content'][0]['eventoId']==event['eventoId'])
call('POST','/api/auditoria/internal/eventos',dict(event,detalles='Contenido diferente'),expected=409,root=audit_url,headers=event_headers)
check('Reusing an event ID with different content is rejected')
legacy=call('GET',filtered,token=admin,root=users_url)
check('The previous read URL forwards to the independent journal',legacy['totalElements']==1 and legacy['content'][0]['eventoId']==event['eventoId'])
stopped=False
databases=['fintech_usuarios','fintech_cuentas','fintech_transacciones','fintech_prestamos']
try:
    stopped=True
    docker('stop','ms-auditoria')
    call('GET','/api/auditoria',token=admin,expected=(502,503,504))
    check('Audit outage is visible to its API')
    call('GET',filtered,token=admin,expected=503,root=users_url)
    operation=str(uuid.uuid4())
    transfer={'numeroCuentaOrigen':origin['numeroCuenta'],'numeroCuentaDestino':destination['numeroCuenta'],'tipoTransaccion':'TRANSFERENCIA','monto':12.34}
    movement=call('POST','/api/transacciones',transfer,token,201,operation)
    call('POST','/api/transacciones',transfer,token,201,operation)
    balance=lambda account:Decimal(str(call('GET',f"/api/cuentas/{account['id']}",token=token)['saldo']))
    check('Transfer completes once while audit is offline',movement['estado']=='COMPLETADA' and balance(origin)==Decimal('187.66') and balance(destination)==Decimal('12.34'))
    third=call('POST','/api/cuentas',{'usuarioId':user['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},token,201,str(uuid.uuid4()))
    call('PATCH',f"/api/cuentas/{third['id']}/activar",token=admin)
    call('POST','/api/usuarios',{'email':f'queued-{suffix}@example.test','password':'Prueba123!','nombre':'Auditoria','apellido':'Pendiente','rol':'CLIENTE'},admin,201)
    loan=call('POST','/api/prestamos',{'usuarioId':user['usuarioId'],'cuentaDesembolsoId':origin['id'],'montoSolicitado':500,'tasaInteres':18,'plazoMeses':3,'tipoPrestamo':'PERSONAL','moneda':'PEN'},token,201,str(uuid.uuid4()))
    call('PATCH',f"/api/prestamos/{loan['id']}/revisar",token=admin)
    call('POST','/api/auditoria/internal/eventos',dict(event,eventoId=str(uuid.uuid4()),detalles='Ruta anterior durante la caída'),
         expected=204,root=users_url,headers=event_headers)
    accepted=call('POST','/api/auditoria/internal',{'accion':'PRUEBA_RUTA_LEGACY','entidadAfectada':'CUENTA','entidadId':origin['id'],'detalles':'Solicitud aceptada durante la caída'},
                  token=admin,expected=202,root=users_url,headers=event_headers)
    check('Legacy synchronous endpoint acknowledges durable queuing with an event reference',bool(accepted.get('eventoId')))
    queued={db:sql(f'SELECT evento_id FROM {db}.eventos_pendientes;').splitlines() for db in databases}
    check('All four producers keep durable pending audit events',all(queued.values()))
    status=subprocess.run([sys.executable,str(Path(__file__).with_name('audit_status.py')),'--project',args.project],text=True,capture_output=True)
    state=json.loads(status.stdout)
    check('Monitoring reports the stopped audit service and pending events',status.returncode==1 and not state['services']['ms-auditoria']['running'] and all(v['pending']>0 for v in state['outboxes'].values()))
    docker('restart','-t','10','ms-cuentas')
    eventually(lambda:balance(origin)==Decimal('187.66'))
    remaining=set(sql('SELECT evento_id FROM fintech_cuentas.eventos_pendientes;').splitlines())
    check('Pending events survive a producer restart',set(queued['fintech_cuentas']).issubset(remaining))
finally:
    if stopped:
        docker('start','ms-auditoria')
        eventually(lambda:call('GET','/api/auditoria?page=0&size=1',token=admin))
        print('Audit service recovered',flush=True)

identifiers=[identifier for events in queued.values() for identifier in events]
assert all(re.fullmatch(r'[A-Za-z0-9:_-]{1,64}',identifier) for identifier in identifiers)
values=','.join("'"+identifier+"'" for identifier in identifiers)
eventually(lambda:int(sql(f'SELECT COUNT(*) FROM fintech_auditoria.auditoria WHERE evento_id IN ({values});'))==len(set(identifiers)))
check('Recovery delivers every queued event exactly once')
for db in databases:
    own=','.join("'"+identifier+"'" for identifier in queued[db])
    eventually(lambda db=db,own=own:int(sql(f'SELECT COUNT(*) FROM {db}.eventos_pendientes WHERE evento_id IN ({own});'))==0)
check('Delivered events leave the source outboxes')
print(json.dumps({'passed':len(passed),'queuedEventsVerified':len(set(identifiers)),'auditRecovered':True},indent=2))
