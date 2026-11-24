"""Integration checks against an explicitly selected disposable FinTech environment.

Creates test users, accounts, financial movements and a loan. Never target a production database.
Usage: python scripts/smoke_test.py --url http://localhost:4300 --mail http://localhost:8125
"""
import argparse
import concurrent.futures
import json
import re
import time
import uuid
from decimal import Decimal
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',required=True)
parser.add_argument('--mail',required=True)
args=parser.parse_args()
base=args.url.rstrip('/')
passed=[]
def call(method,path,data=None,token=None,key=None,expected=200,extra=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    if key: headers['Idempotency-Key']=key
    if extra: headers.update(extra)
    req=Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    try:
        with urlopen(req,timeout=30) as response: code=response.status; raw=response.read()
    except HTTPError as ex: code=ex.code;raw=ex.read()
    body=json.loads(raw) if raw and raw.startswith((b'{',b'[')) else raw.decode()
    allowed=expected if isinstance(expected,tuple) else (expected,)
    assert code in allowed,f'{method} {path}: expected {allowed}, got {code}: {body}'
    return body
def check(name,condition=True):
    assert condition,name
    passed.append(name);print('PASS '+name,flush=True)
def saldo(id,token): return Decimal(str(call('GET',f'/api/cuentas/{id}',token=token)['saldo']))
def movimiento(tipo,cuenta,monto,token,destino=None,key=None,expected=201):
    data={'numeroCuentaOrigen':cuenta['numeroCuenta'],'tipoTransaccion':tipo,'monto':monto,'descripcion':'Verificación automatizada'}
    if destino: data['numeroCuentaDestino']=destino['numeroCuenta']
    return call('POST','/api/transacciones',data,token,key or str(uuid.uuid4()),expected)

call('GET','/api/cuentas',expected=401);check('API requires authentication')
admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
suffix=uuid.uuid4().hex[:10]
def registro(n):
    return call('POST','/api/usuarios/registro',{'email':f'qa-{suffix}-{n}@example.test','password':'Prueba123!','nombre':'Prueba','apellido':str(n)},expected=201)
u=registro(1);v=registro(2);token=u['token'];other=v['token']
call('GET','/api/usuarios',token=token,expected=403);check('CLIENTE cannot administer users')
call('GET',f"/api/usuarios/{v['usuarioId']}",token=token,expected=403);check('User privacy enforced')
def cuenta(user):
    c=call('POST','/api/cuentas',{'usuarioId':user['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},user['token'],expected=201)
    assert re.fullmatch(r'FT\d{8}',c['numeroCuenta'])
    call('PATCH',f"/api/cuentas/{c['id']}/activar",token=admin)
    return c
c=cuenta(u);d=cuenta(v)
check('Account opening and activation')
call('GET',f"/api/cuentas/{d['id']}",token=token,expected=403)
call('GET',f"/api/cuentas/usuario/{v['usuarioId']}",token=token,expected=403)
check('Foreign account reads rejected')
call('POST','/api/cuentas',{'usuarioId':v['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN'},token,expected=403)
call('POST','/api/cuentas',{'usuarioId':u['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':10},token,expected=403)
check('Foreign account creation and unfunded initial credit rejected')
movimiento('DESEMBOLSO_PRESTAMO',c,500,token,expected=403)
movimiento('RETIRO',d,1,token,expected=403)
check('Direct loan disbursement and foreign debit rejected')
movimiento('DEPOSITO',c,20000,token)
key=str(uuid.uuid4());t=movimiento('TRANSFERENCIA',c,100,token,d,key)
assert t['estado']=='COMPLETADA'
assert saldo(c['id'],admin)==Decimal('19900') and saldo(d['id'],admin)==Decimal('100')
again=movimiento('TRANSFERENCIA',c,100,token,d,key)
check('Transfer retry is idempotent',again['id']==t['id'] and saldo(c['id'],admin)==Decimal('19900'))
movimiento('TRANSFERENCIA',c,101,token,d,key,409);check('Same key with changed amount rejected')
call('GET',f"/api/transacciones/{t['id']}",token=other);check('Recipient can read own transfer')
rev=call('POST',f"/api/transacciones/{t['id']}/revertir",token=admin,expected=201)
again=call('POST',f"/api/transacciones/{t['id']}/revertir",token=admin,expected=201)
check('Reversal retry is idempotent',again['id']==rev['id'] and saldo(c['id'],admin)==Decimal('20000') and saldo(d['id'],admin)==0)
call('POST',f"/api/transacciones/{rev['id']}/revertir",token=admin,expected=409);check('Reversal cannot be reversed')
call('PATCH',f"/api/cuentas/{d['id']}/bloquear?motivo=Prueba%20automatizada",token=admin)
before=saldo(c['id'],admin)
movimiento('TRANSFERENCIA',c,10,token,d,expected=409)
check('Rejected transfer leaves both balances unchanged',saldo(c['id'],admin)==before and saldo(d['id'],admin)==0)
call('PATCH',f"/api/cuentas/{d['id']}/desbloquear",token=admin)
for _ in range(3): movimiento('RETIRO',c,999999,token,expected=409)
alertas=call('GET','/api/alertas?tipoAlerta=INTENTOS_FALLIDOS',token=admin)
check('Insufficient-funds attempts trigger fraud alert',alertas['totalElements']>=1)
aid=alertas['content'][0]['id']
call('OPTIONS',f'/api/alertas/{aid}/resolver',extra={'Origin':'http://localhost:4200','Access-Control-Request-Method':'PATCH','Access-Control-Request-Headers':'authorization,content-type'},expected=200)
call('PATCH',f'/api/alertas/{aid}/resolver',{'estado':'RESUELTA','observacion':'Revisado en prueba'},admin)
check('Alert PATCH and CORS work')

# Distinct concurrent debits must preserve exact totals. Retry transient lock conflicts with the same key.
before=saldo(c['id'],admin)
def retiro(_):
    key=str(uuid.uuid4())
    for attempt in range(5):
        try: return movimiento('RETIRO',c,1,token,key=key)
        except (AssertionError, URLError, TimeoutError):
            if attempt==4: raise
            time.sleep(.2)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(retiro,range(8)))
check('Concurrent withdrawals preserve exact balance',saldo(c['id'],admin)==before-8)

loan={'usuarioId':u['usuarioId'],'cuentaDesembolsoId':c['id'],'montoSolicitado':500,'tasaInteres':18,'plazoMeses':3,'tipoPrestamo':'PERSONAL','moneda':'PEN'}
bad=dict(loan,moneda='USD');call('POST','/api/prestamos',bad,token,expected=400)
p=call('POST','/api/prestamos',loan,token,expected=201);pid=p['id']
check('Loan currency validation and interest included',Decimal(str(p['saldoPendiente']))>500)
call('GET',f'/api/prestamos/{pid}',token=other,expected=403)
call('PATCH',f'/api/prestamos/{pid}/aprobar',{},token,expected=403)
call('PATCH',f'/api/prestamos/{pid}/revisar',token=admin)
call('PATCH',f'/api/prestamos/{pid}/aprobar',{},admin)
before=saldo(c['id'],admin)
call('POST',f'/api/prestamos/{pid}/desembolsar',{},admin)
call('POST',f'/api/prestamos/{pid}/desembolsar',{},admin)
check('Loan disbursement retry credits once',saldo(c['id'],admin)==before+500)
payment={'cuentaId':c['id'],'monto':50,'operacionId':str(uuid.uuid4())}
before=saldo(c['id'],admin)
first=call('POST',f'/api/prestamos/{pid}/pagar',payment,token)
again=call('POST',f'/api/prestamos/{pid}/pagar',payment,token)
check('Loan payment retry debits once',saldo(c['id'],admin)==before-50 and first['saldoPendiente']==again['saldoPendiente'])
call('DELETE',f"/api/cuentas/{c['id']}",token=admin,expected=409);check('Account with obligation cannot be deleted')
for _ in range(15):
    audit=call('GET',f'/api/auditoria?entidadAfectada=PRESTAMO&accion=PAGO_PRESTAMO&usuarioEjecutor=qa-{suffix}-1%40example.test',token=admin)
    if any(e['accion']=='PAGO_PRESTAMO' and e['entidadId']==pid for e in audit['content']): break
    time.sleep(1)
check('Persistent audit events delivered',any(e['accion']=='PAGO_PRESTAMO' and e['entidadId']==pid for e in audit['content']))

# Password recovery uses real SMTP (Mailpit in this disposable environment).
resp=call('POST','/api/usuarios/password/forgot',{'email':f'qa-{suffix}-1@example.test'})
check('Recovery response never exposes a token','link' not in resp)
with urlopen(args.mail.rstrip('/')+'/api/v1/messages',timeout=15) as r: messages=json.load(r)['messages']
message=next(m for m in messages if any(a['Address']==f'qa-{suffix}-1@example.test' for a in m['To']))
with urlopen(args.mail.rstrip('/')+'/api/v1/message/'+message['ID'],timeout=15) as r: content=json.load(r)
reset_token=re.search(r'token=([a-zA-Z0-9]+)',content['Text']).group(1)
call('POST','/api/usuarios/password/reset',{'token':reset_token,'nuevaPassword':'Nueva123!'})
call('GET',f"/api/cuentas/usuario/{u['usuarioId']}",token=token,expected=401)
call('POST','/api/usuarios/password/reset',{'token':reset_token,'nuevaPassword':'Otra123!'},expected=400)
check('SMTP recovery works, token is single-use, previous JWT revoked')
token=call('POST','/api/usuarios/login',{'email':f'qa-{suffix}-1@example.test','password':'Nueva123!'})['token']
call('PATCH',f"/api/usuarios/{u['usuarioId']}/estado?activo=false",token=admin)
call('GET',f"/api/cuentas/usuario/{u['usuarioId']}",token=token,expected=401)
check('Deactivation immediately revokes JWT across services')
print(json.dumps({'passed':len(passed),'checks':passed},indent=2))
