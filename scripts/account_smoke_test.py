"""Account opening and state checks. Creates demo data in a disposable environment."""
import argparse
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',required=True)
parser.add_argument('--fixture')
args=parser.parse_args()
base=args.url.rstrip('/')
passed=[]

def call(method,path,data=None,token=None,expected=200,key=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    if key: headers['Idempotency-Key']=key
    try:
        with urlopen(Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method),timeout=40) as r:
            status=r.status
            raw=r.read()
    except HTTPError as e:
        status=e.code
        raw=e.read()
    body=json.loads(raw) if raw else None
    assert status==expected,f'{method} {path}: {status}: {body}'
    return body

def check(name,condition=True):
    assert condition,name
    passed.append(name)
    print('PASS '+name,flush=True)

admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
email=f'accounts-{uuid.uuid4().hex[:10]}@example.test'
user=call('POST','/api/usuarios/registro',{'email':email,'password':'Prueba123!','nombre':'Prueba','apellido':'Cuentas'},expected=201)
other=call('POST','/api/usuarios/registro',{'email':f'other-{uuid.uuid4().hex[:10]}@example.test','password':'Prueba123!','nombre':'Otro','apellido':'Cliente'},expected=201)
token=user['token']
body={'usuarioId':user['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0}
key=str(uuid.uuid4())
with ThreadPoolExecutor(max_workers=6) as pool:
    accounts=list(pool.map(lambda _:call('POST','/api/cuentas',body,token,201,key),range(6)))
account=accounts[0]
rows=call('GET',f"/api/cuentas/usuario/{user['usuarioId']}",token=token)
check('Concurrent opening creates exactly one zero-balance pending account',len(rows)==1 and len({a['id'] for a in accounts})==1 and account['saldo']==0 and account['estado']=='PENDIENTE_VERIFICACION')
call('POST','/api/cuentas',dict(body,moneda='USD'),token,409,key)
check('An opening key cannot be reused with different conditions')
call('POST','/api/cuentas',body,token,400,'short')
call('POST','/api/cuentas',dict(body,saldoInicial=1),token,403,str(uuid.uuid4()))
call('POST','/api/cuentas',dict(body,usuarioId=other['usuarioId']),token,403,str(uuid.uuid4()))
check('Opening validates the key, owner and client zero-balance rule')
call('GET',f"/api/cuentas/{account['id']}",token=other['token'],expected=403)
call('PATCH',f"/api/cuentas/{account['id']}/activar",token=token,expected=403)
check('Foreign access and client administration are forbidden')
aid=account['id']
call('PATCH',f'/api/cuentas/{aid}/activar',token=admin)
call('PATCH',f'/api/cuentas/{aid}/activar',token=admin)
replayed=call('POST','/api/cuentas',body,token,201,key)
check('Retry returns the existing account with its current state',replayed['id']==aid and replayed['estado']=='ACTIVA')
call('PATCH',f'/api/cuentas/{aid}/bloquear?motivo=no',token=admin,expected=400)
call('PATCH',f'/api/cuentas/{aid}/bloquear?motivo='+('x'*501),token=admin,expected=400)
for _ in range(2): call('PATCH',f'/api/cuentas/{aid}/bloquear?motivo=Revision%20de%20seguridad',token=admin)
check('Blocking validates reason length and supports a repeated confirmation')
for _ in range(2): call('PATCH',f'/api/cuentas/{aid}/desbloquear',token=admin)
for _ in range(2): call('PATCH',f'/api/cuentas/{aid}/congelar?motivo=Revision%20de%20seguridad',token=admin)
for _ in range(2): call('PATCH',f'/api/cuentas/{aid}/desbloquear',token=admin)
check('Freezing and unblocking support repeated confirmations')
funded=call('POST','/api/cuentas',dict(body,saldoInicial=10),admin,201,str(uuid.uuid4()))
call('PATCH',f"/api/cuentas/{funded['id']}/activar",token=admin)
call('PATCH',f"/api/cuentas/{funded['id']}/cerrar",token=admin,expected=409)
check('Nonzero balance prevents closing')
call('POST','/api/transacciones',{'numeroCuentaOrigen':funded['numeroCuenta'],'tipoTransaccion':'RETIRO','monto':10},token,201,str(uuid.uuid4()))
for _ in range(2): call('PATCH',f"/api/cuentas/{funded['id']}/cerrar",token=admin)
call('PATCH',f"/api/cuentas/{funded['id']}/activar",token=admin,expected=409)
closed=call('GET',f"/api/cuentas/{funded['id']}",token=token)
history=call('GET',f"/api/transacciones/cuenta/{funded['id']}",token=token)
check('Closing preserves history and prevents reactivation',closed['estado']=='CERRADA' and len(history)==1)
loan=call('POST','/api/prestamos',{'usuarioId':user['usuarioId'],'cuentaDesembolsoId':aid,'montoSolicitado':500,'tasaInteres':18,'plazoMeses':3,'tipoPrestamo':'PERSONAL','moneda':'PEN'},token,201,str(uuid.uuid4()))
call('PATCH',f'/api/cuentas/{aid}/cerrar',token=admin,expected=409)
check('Outstanding loan prevents closing a zero-balance account')
rollback_key=str(uuid.uuid4())
call('POST','/api/cuentas',dict(body,moneda='INVALID'),token,400,rollback_key)
recovered=call('POST','/api/cuentas',body,token,201,rollback_key)
check('A rejected opening rolls back the key and can be corrected',recovered['estado']=='PENDIENTE_VERIFICACION')
legacy=call('POST','/api/cuentas',body,token,201)
check('Legacy opening without an idempotency header remains supported',legacy['id']!=aid)
if args.fixture:
    Path(args.fixture).write_text(json.dumps({'email':email,'account':aid,'number':account['numeroCuenta'],'closed':funded['id'],'pending':legacy['id']}),encoding='utf-8')
print(json.dumps({'passed':len(passed)},indent=2))
