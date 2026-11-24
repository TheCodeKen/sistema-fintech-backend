"""Transaction detail, receipts and reversals. Only run against a disposable environment."""
import argparse
import concurrent.futures
import json
import uuid
from decimal import Decimal
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',required=True)
parser.add_argument('--fixture',help='Optional local output for browser QA, without tokens')
args=parser.parse_args()
base=args.url.rstrip('/')
passed=[]
def call(method,path,data=None,token=None,key=None,expected=200,pdf=False):
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    if key:headers['Idempotency-Key']=key
    req=Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    try:
        with urlopen(req,timeout=30) as r:code=r.status;raw=r.read();response_headers=r.headers
    except HTTPError as e:code=e.code;raw=e.read();response_headers=e.headers
    assert code==expected,f'{method} {path}: expected {expected}, got {code}: {raw[:400]}'
    if pdf:
        assert raw.startswith(b'%PDF-') and response_headers.get_content_type()=='application/pdf'
        assert 'no-store' in response_headers.get('Cache-Control','')
        assert 'attachment;' in response_headers.get('Content-Disposition','')
        return raw
    return json.loads(raw) if raw else None
def check(name,condition=True):
    assert condition,name
    passed.append(name);print('PASS '+name,flush=True)
admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
suffix=uuid.uuid4().hex[:10]
def user(n):return call('POST','/api/usuarios/registro',{'email':f'tx-{suffix}-{n}@example.test','password':'Prueba123!','nombre':'Prueba','apellido':str(n)},expected=201)
u=user(1);v=user(2);w=user(3);t=u['token']
def account(user,currency='PEN'):
    c=call('POST','/api/cuentas',{'usuarioId':user['usuarioId'],'tipoCuenta':'AHORROS','moneda':currency,'saldoInicial':0},user['token'],expected=201)
    call('PATCH',f"/api/cuentas/{c['id']}/activar",token=admin);return c
c=account(u);d=account(v);usd=account(v,'USD')
def balance(c):return Decimal(str(call('GET',f"/api/cuentas/{c['id']}",token=admin)['saldo']))
deposit={'numeroCuentaOrigen':c['numeroCuenta'],'tipoTransaccion':'DEPOSITO','monto':1000,'descripcion':'Fondos de prueba'}
call('POST','/api/transacciones',deposit,t,str(uuid.uuid4()),201)
transfer={'numeroCuentaOrigen':c['numeroCuenta'],'numeroCuentaDestino':d['numeroCuenta'],'tipoTransaccion':'TRANSFERENCIA','monto':75.25,'moneda':'PEN','descripcion':'Transferencia de verificación'}
before=balance(c)
review=call('POST','/api/transacciones/revisar',transfer,t)
check('Review validates destination and estimates origin balance without moving money',review['numeroCuentaDestino']==d['numeroCuenta'] and Decimal(str(review['saldoEstimado']))==before-Decimal('75.25') and balance(c)==before and balance(d)==0)
check('Review does not expose destination owner or balance',set(review)=={'numeroCuentaOrigen','numeroCuentaDestino','moneda','monto','saldoDisponible','saldoEstimado'})
call('POST','/api/transacciones/revisar',dict(transfer,numeroCuentaDestino=usd['numeroCuenta']),t,expected=400)
call('POST','/api/transacciones/revisar',transfer,w['token'],expected=403)
call('PATCH',f"/api/cuentas/{d['id']}/bloquear?motivo=Verificacion",token=admin)
call('POST','/api/transacciones/revisar',transfer,t,expected=409)
call('PATCH',f"/api/cuentas/{d['id']}/desbloquear",token=admin)
check('Preview rejects foreign origin, wrong currency and blocked destination')
call('POST','/api/transacciones',transfer,t,expected=400)
check('Missing operation header returns validation error rather than server error')
key=str(uuid.uuid4());tx=call('POST','/api/transacciones',transfer,t,key,201);tid=tx['id']
retry=call('POST','/api/transacciones',transfer,t,key,201)
check('Transfer retry moves funds once',retry['id']==tid and balance(c)==before-Decimal('75.25') and balance(d)==Decimal('75.25'))
for token in [t,v['token'],admin]:
    detail=call('GET',f'/api/transacciones/{tid}/detalle',token=token)
    assert detail['movimiento']['numeroReferencia']==tx['numeroReferencia']
    call('GET',f'/api/transacciones/{tid}/comprobante',token=token,pdf=True)
check('Owner, recipient and administrator can read detail and download PDF')
call('GET',f'/api/transacciones/{tid}/detalle',token=w['token'],expected=403)
call('GET',f'/api/transacciones/{tid}/comprobante',token=w['token'],expected=403)
call('GET',f'/api/transacciones/{tid}/comprobante',expected=401)
check('Foreign and anonymous users cannot download private receipts')
call('POST',f'/api/transacciones/{tid}/revertir',{},t,expected=403)
def reverse(_):return call('POST',f'/api/transacciones/{tid}/revertir',{},admin,expected=201)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:reversals=list(pool.map(reverse,range(2)))
rid=reversals[0]['id']
check('Concurrent reversal requests compensate once',reversals[1]['id']==rid and balance(c)==before and balance(d)==0)
detail=call('GET',f'/api/transacciones/{tid}/detalle',token=t)
reverse_detail=call('GET',f'/api/transacciones/{rid}/detalle',token=v['token'])
check('Original and reversal expose linked references',detail['movimiento']['estado']=='REVERTIDA' and detail['reversion']['id']==rid and reverse_detail['original']['id']==tid)
call('GET',f'/api/transacciones/{tid}/comprobante',token=t,pdf=True)
check('Reverted movement still has a receipt showing its current state')
replayed=call('POST','/api/transacciones',transfer,t,key,201)
check('Retrying a reversed original preserves reversed state and balances',replayed['estado']=='REVERTIDA' and balance(c)==before and balance(d)==0)
bad={'numeroCuentaOrigen':c['numeroCuenta'],'tipoTransaccion':'RETIRO','monto':99999}
call('POST','/api/transacciones',bad,t,str(uuid.uuid4()),409)
rows=call('GET',f"/api/transacciones/cuenta/{c['id']}",token=t)
failed=next(x for x in rows if x['estado']=='FALLIDA')
call('GET',f"/api/transacciones/{failed['id']}/comprobante",token=t,expected=409)
check('Rejected movement has no successful receipt and does not debit funds',balance(c)==before)
if args.fixture:
    Path(args.fixture).write_text(json.dumps({'email':f'tx-{suffix}-1@example.test','recipientEmail':f'tx-{suffix}-2@example.test','origin':c['numeroCuenta'],'destination':d['numeroCuenta'],'original':tid,'reversal':rid,'failed':failed['id']}),encoding='utf-8')
print(json.dumps({'passed':len(passed),'checks':passed},indent=2))
