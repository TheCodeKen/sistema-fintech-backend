"""Personal notifications end-to-end. Creates financial demo data; disposable environments only."""
import argparse
import concurrent.futures
import json
import subprocess
import time
import uuid
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',required=True)
parser.add_argument('--fixture',help='Optional browser QA fixture output, without tokens')
parser.add_argument('--test-due-dates',action='store_true',help='Change only the new test loan dates in fintech-verificacion MySQL')
args=parser.parse_args();base=args.url.rstrip('/');passed=[]
if args.test_due_dates and base!='http://localhost:4300':parser.error('Due-date simulation is restricted to localhost:4300 and fintech-verificacion')
def call(method,path,data=None,token=None,key=None,expected=200,headers=None):
    h={'Content-Type':'application/json'}
    if token:h['Authorization']='Bearer '+token
    if key:h['Idempotency-Key']=key
    if headers:h.update(headers)
    try:
        with urlopen(Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=h,method=method),timeout=30) as r:status=r.status;raw=r.read()
    except HTTPError as e:status=e.code;raw=e.read()
    assert status==expected,f'{method} {path}: expected {expected}, got {status}: {raw[:300]}'
    return json.loads(raw) if raw else None
def check(name,condition=True):
    assert condition,name
    passed.append(name);print('PASS '+name,flush=True)
def inbox(token,**query):
    from urllib.parse import urlencode
    return call('GET','/api/usuarios/notificaciones?'+urlencode({'size':50,**query}),token=token)
def wait_for(predicate,token,seconds=25):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        rows=inbox(token)['content']
        if predicate(rows):return rows
        time.sleep(1)
    raise AssertionError('Notification delivery timed out')
call('GET','/api/usuarios/notificaciones',expected=401)
call('GET','/api/usuarios/notificaciones/resumen',expected=401)
check('Inbox and counter require authentication')
admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
suffix=uuid.uuid4().hex[:10]
def user(n):return call('POST','/api/usuarios/registro',{'email':f'notice-{suffix}-{n}@example.test','password':'Prueba123!','nombre':'Avisos','apellido':str(n)},expected=201)
u=user(1);v=user(2);t=u['token'];other=v['token']
def account(user):
    c=call('POST','/api/cuentas',{'usuarioId':user['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},user['token'],expected=201)
    call('PATCH',f"/api/cuentas/{c['id']}/activar",token=admin);return c
c=account(u);d=account(v)
fake={'clave':'fake-'+suffix,'usuarioId':u['usuarioId'],'tipo':'MOVIMIENTO_CONFIRMADO','recursoId':1,'titulo':'Falso','mensaje':'No debe aparecer','fechaEvento':'2026-11-14T10:00:00'}
call('POST','/api/usuarios/notificaciones/internal/eventos',fake,t,expected=403,headers={'X-Internal-Service':'clave-incorrecta'})
check('Client cannot forge internal notifications',inbox(t)['totalElements']==0)
deposit=call('POST','/api/transacciones',{'numeroCuentaOrigen':c['numeroCuenta'],'tipoTransaccion':'DEPOSITO','monto':1000,'descripcion':'Fondos para verificar avisos'},t,str(uuid.uuid4()),201)
transfer={'numeroCuentaOrigen':c['numeroCuenta'],'numeroCuentaDestino':d['numeroCuenta'],'tipoTransaccion':'TRANSFERENCIA','monto':50,'descripcion':'Aviso de transferencia'}
key=str(uuid.uuid4());tx=call('POST','/api/transacciones',transfer,t,key,201);call('POST','/api/transacciones',transfer,t,key,201)
rows=wait_for(lambda r:any(n['enlace']==f"/transacciones/{tx['id']}" for n in r),t)
recipient=wait_for(lambda r:any(n['enlace']==f"/transacciones/{tx['id']}" for n in r),other)
mine=next(n for n in rows if n['enlace']==f"/transacciones/{tx['id']}")
check('Transfer creates one notice for sender and recipient despite retry',sum(n['enlace']==mine['enlace'] for n in rows)==1 and sum(n['enlace']==mine['enlace'] for n in recipient)==1 and mine['titulo']=='Transferencia enviada' and recipient[0]['titulo']=='Transferencia recibida')
call('PATCH',f"/api/usuarios/notificaciones/{mine['id']}/leer",token=other,expected=404)
call('PATCH',f"/api/usuarios/notificaciones/{mine['id']}/leer",token=admin,expected=404)
check('Other clients and administrators cannot mark another personal inbox')
call('PATCH',f"/api/usuarios/notificaciones/{mine['id']}/leer",token=t,expected=204)
first_read=next(n for n in inbox(t)['content'] if n['id']==mine['id'])['leidaEn']
call('PATCH',f"/api/usuarios/notificaciones/{mine['id']}/leer",token=t,expected=204)
call('POST','/api/transacciones',transfer,t,key,201)
check('Read state persists and retry never resets it',next(n for n in inbox(t)['content'] if n['id']==mine['id'])['leidaEn']==first_read)
if args.test_due_dates:
    # Replay an already-delivered event from a trusted producer, without exporting its service key.
    replay={'clave':f"tx:{tx['id']}:{u['usuarioId']}",'usuarioId':u['usuarioId'],'tipo':'MOVIMIENTO_CONFIRMADO','recursoId':tx['id'],'titulo':'No cambiar el aviso original','mensaje':mine['mensaje'],'fechaEvento':mine['fechaEvento']}
    subprocess.run(['docker','compose','-p','fintech-verificacion','exec','-T','ms-prestamos','sh','-c','wget -q -O /dev/null --header="X-Internal-Service: $INTERNAL_SERVICE_KEY" --header="Content-Type: application/json" --post-data="$1" http://ms-usuarios:8081/api/usuarios/notificaciones/internal/eventos','sh',json.dumps(replay)],check=True)
    after=next(n for n in inbox(t)['content'] if n['id']==mine['id'])
    check('Redelivery at the receiver preserves original message and read state',after['titulo']==mine['titulo'] and after['leidaEn']==first_read)
def reverse(_):return call('POST',f"/api/transacciones/{tx['id']}/revertir",{},admin,expected=201)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:reversals=list(pool.map(reverse,range(2)))
rid=reversals[0]['id'];assert reversals[1]['id']==rid
rows=wait_for(lambda r:any(n['enlace']==f'/transacciones/{rid}' for n in r),t)
check('Concurrent reversal produces one compensating notice per user',sum(n['enlace']==f'/transacciones/{rid}' for n in rows)==1)
def loan():return call('POST','/api/prestamos',{'usuarioId':u['usuarioId'],'cuentaDesembolsoId':c['id'],'montoSolicitado':500,'tasaInteres':18,'plazoMeses':3,'tipoPrestamo':'PERSONAL','moneda':'PEN'},t,expected=201)['id']
pid=loan();call('PATCH',f'/api/prestamos/{pid}/revisar',token=admin);call('PATCH',f'/api/prestamos/{pid}/aprobar',{},admin)
call('POST',f'/api/prestamos/{pid}/desembolsar',{},admin);call('POST',f'/api/prestamos/{pid}/desembolsar',{},admin)
payment={'cuentaId':c['id'],'monto':30,'operacionId':str(uuid.uuid4())}
call('POST',f'/api/prestamos/{pid}/pagar',payment,t);call('POST',f'/api/prestamos/{pid}/pagar',payment,t)
expected_types={'PRESTAMO_SOLICITADO','PRESTAMO_EN_REVISION','PRESTAMO_APROBADO','PRESTAMO_DESEMBOLSADO','PRESTAMO_PAGO'}
rows=wait_for(lambda r:expected_types.issubset({n['tipo'] for n in r if n['enlace']==f'/prestamos/{pid}'}),t)
loan_rows=[n for n in rows if n['enlace']==f'/prestamos/{pid}']
check('Loan lifecycle and payment delivered without duplicate loan/transaction confirmations',len(loan_rows)==5 and len({n['tipo'] for n in loan_rows})==5)
cancelled=loan();call('POST',f'/api/prestamos/{cancelled}/cancelar',{'motivo':'Verificar cancelacion'},t);call('POST',f'/api/prestamos/{cancelled}/cancelar',{'motivo':'Verificar cancelacion'},t)
wait_for(lambda r:any(n['tipo']=='PRESTAMO_CANCELADO' and n['enlace']==f'/prestamos/{cancelled}' for n in r),t)
check('Cancellation is delivered once')
if args.test_due_dates:
    sql=f"UPDATE cuotas_prestamo SET vencimiento=DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-05:00')), INTERVAL (CASE numero WHEN 1 THEN -1 WHEN 2 THEN 2 ELSE 60 END) DAY) WHERE prestamo_id={int(pid)};"
    subprocess.run(['docker','compose','-p','fintech-verificacion','exec','-T','mysql-db','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" fintech_prestamos -e "$1"','sh',sql],check=True)
    print('Waiting for scheduled upcoming and overdue notices...',flush=True)
    rows=wait_for(lambda r:{'CUOTA_PROXIMA','CUOTA_VENCIDA'}.issubset({n['tipo'] for n in r if n['enlace']==f'/prestamos/{pid}'}),t,80)
    call('GET',f'/api/prestamos/{pid}/detalle',token=t);call('GET',f'/api/prestamos/{pid}/detalle',token=t)
    rows=inbox(t)['content']
    check('Scheduler issues upcoming and overdue notices once for unpaid quotas',sum(n['tipo']=='CUOTA_PROXIMA' and n['enlace']==f'/prestamos/{pid}' for n in rows)==1 and sum(n['tipo']=='CUOTA_VENCIDA' and n['enlace']==f'/prestamos/{pid}' for n in rows)==1)
rows=inbox(t)['content'];cutoff=max(n['id'] for n in rows)
new_tx=call('POST','/api/transacciones',{'numeroCuentaOrigen':c['numeroCuenta'],'tipoTransaccion':'DEPOSITO','monto':1},t,str(uuid.uuid4()),201)
rows=wait_for(lambda r:any(n['enlace']==f"/transacciones/{new_tx['id']}" for n in r),t)
call('PATCH','/api/usuarios/notificaciones/leer-todas',{'hastaId':cutoff},t,expected=204)
unread=inbox(t,noLeidas='true')['content']
check('Mark all preserves notifications arriving after the viewed boundary',len(unread)==1 and unread[0]['enlace']==f"/transacciones/{new_tx['id']}")
check('Counter matches unread filter',call('GET','/api/usuarios/notificaciones/resumen',token=t)['noLeidas']==len(unread))
check('Client cannot select another recipient with query parameters',inbox(t,usuarioId=v['usuarioId'])['totalElements']==inbox(t)['totalElements'])
call('GET','/api/usuarios/notificaciones?size=51',token=t,expected=400)
call('PATCH','/api/usuarios/notificaciones/leer-todas',{'hastaId':0},t,expected=400)
check('Pagination and bulk read boundaries validated')
if args.fixture:Path(args.fixture).write_text(json.dumps({'email':f'notice-{suffix}-1@example.test','recipientEmail':f'notice-{suffix}-2@example.test','loan':pid,'movement':tx['id'],'unreadId':unread[0]['id']}),encoding='utf-8')
print(json.dumps({'passed':len(passed),'checks':passed},indent=2))
