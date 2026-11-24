"""Loan lifecycle checks. Use only a disposable environment: --url http://localhost:4300."""
import argparse
import json
import uuid
from decimal import Decimal
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',required=True)
args=parser.parse_args()
base=args.url.rstrip('/')
passed=[]
def call(method,path,data=None,token=None,expected=200,key=None):
    headers={'Content-Type':'application/json'}
    if key is not False: headers['Idempotency-Key']=key or str(uuid.uuid4())
    if token: headers['Authorization']='Bearer '+token
    req=Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    try:
        with urlopen(req,timeout=30) as r: code=r.status; raw=r.read()
    except HTTPError as e: code=e.code; raw=e.read()
    body=json.loads(raw) if raw else None
    assert code==expected,f'{method} {path}: {code}: {body}'
    return body
def check(name,condition=True):
    assert condition,name
    passed.append(name)
    print('PASS '+name,flush=True)
admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
email=f'loan-{uuid.uuid4().hex[:10]}@example.test'
u=call('POST','/api/usuarios/registro',{'email':email,'password':'Prueba123!','nombre':'Ciclo','apellido':'Prestamo'},expected=201)
other=call('POST','/api/usuarios/registro',{'email':f'other-{uuid.uuid4().hex[:10]}@example.test','password':'Prueba123!','nombre':'Otro','apellido':'Cliente'},expected=201)['token']
t=u['token']
c=call('POST','/api/cuentas',{'usuarioId':u['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},t,201)
call('PATCH',f"/api/cuentas/{c['id']}/activar",token=admin)
def create():
    return call('POST','/api/prestamos',{'usuarioId':u['usuarioId'],'cuentaDesembolsoId':c['id'],'montoSolicitado':500,'tasaInteres':18,'plazoMeses':3,'tipoPrestamo':'PERSONAL','moneda':'PEN'},t,201)['id']
def detail(pid): return call('GET',f'/api/prestamos/{pid}/detalle',token=t)
def balance(): return Decimal(str(call('GET',f"/api/cuentas/{c['id']}",token=t)['saldo']))
pid=create()
d=detail(pid)
check('Pending request has no schedule or due date',not d['cuotas'] and not d['prestamo']['fechaVencimiento'])
call('GET',f'/api/prestamos/{pid}/detalle',token=other,expected=403)
call('POST',f'/api/prestamos/{pid}/cancelar',{'motivo':'Solicitud ajena'},other,403)
check('Foreign details and cancellation forbidden')
call('POST',f'/api/prestamos/{pid}/cancelar',{'motivo':'no'},t,400)
call('POST',f'/api/prestamos/{pid}/cancelar',{'motivo':'Cambio de planes'},t)
call('POST',f'/api/prestamos/{pid}/cancelar',{'motivo':'Cambio de planes'},t)
check('Cancellation validates reason and is idempotent',detail(pid)['prestamo']['estado']=='CANCELADO' and balance()==0)
call('PATCH',f'/api/prestamos/{pid}/aprobar',{},admin,409)
check('Cancelled request cannot be approved')
pid=create()
call('PATCH',f'/api/prestamos/{pid}/revisar',token=admin)
call('PATCH',f'/api/prestamos/{pid}/aprobar',{},admin)
call('POST',f'/api/prestamos/{pid}/cancelar',{'motivo':'Cambio de planes'},t,409)
call('POST',f'/api/prestamos/{pid}/cancelar',{'motivo':'Revision administrativa'},admin)
check('Only admin can cancel an approved request',balance()==0)
pid=create()
call('PATCH',f'/api/prestamos/{pid}/revisar',token=admin)
call('PATCH',f'/api/prestamos/{pid}/aprobar',{},admin)
call('POST',f'/api/prestamos/{pid}/desembolsar',{},admin)
d=detail(pid)
debt=Decimal(str(d['prestamo']['saldoPendiente']))
check('Disbursement creates exactly three balanced installments',len(d['cuotas'])==3 and sum(Decimal(str(q['importe'])) for q in d['cuotas'])==debt and d['prestamo']['fechaDesembolso'] and d['proximoVencimiento'])
call('POST',f'/api/prestamos/{pid}/cancelar',{'motivo':'Cancelar deuda'},admin,409)
check('Disbursed debt cannot be cancelled')
payment={'cuentaId':c['id'],'monto':50,'operacionId':str(uuid.uuid4())}
before=balance()
call('POST',f'/api/prestamos/{pid}/pagar',payment,t)
call('POST',f'/api/prestamos/{pid}/pagar',payment,t)
d=detail(pid)
check('Partial payment allocated oldest first and retry recorded once',balance()==before-50 and len(d['pagos'])==1 and Decimal(str(d['cuotas'][0]['pagado']))==50 and d['cuotas'][1]['pagado']==0)
check('Payment history contains timestamp and transaction reference',d['pagos'][0]['fechaPago'] and d['pagos'][0]['transaccionId'] and not d['pagos'][0]['historico'])
# Fund the interest portion using the ordinary deposit endpoint.
req={'numeroCuentaOrigen':c['numeroCuenta'],'tipoTransaccion':'DEPOSITO','monto':100,'descripcion':'QA ciclo de prestamo'}
call('POST','/api/transacciones',req,t,201)
payment={'cuentaId':c['id'],'monto':float(debt-50),'operacionId':str(uuid.uuid4())}
call('POST',f'/api/prestamos/{pid}/pagar',payment,t)
d=detail(pid)
check('Final payment closes debt and every installment',d['prestamo']['estado']=='PAGADO' and d['prestamo']['saldoPendiente']==0 and d['cuotasPagadas']==3 and not d['proximoVencimiento'] and d['saldoVencido']==0)
call('POST',f'/api/prestamos/{pid}/pagar',dict(payment,monto=1,operacionId=str(uuid.uuid4())),t,409)
check('Paid loan rejects new payments')
body={'usuarioId':u['usuarioId'],'cuentaDesembolsoId':c['id'],'montoSolicitado':500,'tasaInteres':18,'plazoMeses':3,'tipoPrestamo':'PERSONAL','moneda':'PEN'}
key=str(uuid.uuid4())
before=len(call('GET',f"/api/prestamos/usuario/{u['usuarioId']}",token=t))
with ThreadPoolExecutor(max_workers=6) as pool:
    responses=list(pool.map(lambda _:call('POST','/api/prestamos',body,t,201,key),range(6)))
same_id=responses[0]['id']
after=len(call('GET',f"/api/prestamos/usuario/{u['usuarioId']}",token=t))
check('Concurrent request confirmations create exactly one loan',len({r['id'] for r in responses})==1 and after==before+1)
call('POST','/api/prestamos',dict(body,montoSolicitado=600),t,409,key)
check('Reusing a request key with different terms is rejected')
call('POST',f'/api/prestamos/{same_id}/cancelar',{'motivo':'Fin de prueba concurrente'},t)
replayed=call('POST','/api/prestamos',body,t,201,key)
check('Retry returns current loan state without creating another',replayed['id']==same_id and replayed['estado']=='CANCELADO')
call('POST','/api/prestamos',body,other,403,key)
check('Request replay cannot bypass ownership')
call('POST','/api/prestamos',dict(body,montoSolicitado=499),t,400,str(uuid.uuid4()))
call('POST','/api/prestamos',body,t,201,False)
check('Legacy request without a key remains supported')
call('POST','/api/prestamos',dict(body,montoSolicitado=9999999999999.99,tasaInteres=18,plazoMeses=360),t,400)
check('Excess total debt returns a validation error')
inactive=call('POST','/api/cuentas',{'usuarioId':u['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},t,201)
retry_body=dict(body,cuentaDesembolsoId=inactive['id'])
retry_key=str(uuid.uuid4())
call('POST','/api/prestamos',retry_body,t,400,retry_key)
call('PATCH',f"/api/cuentas/{inactive['id']}/activar",token=admin)
recovered=call('POST','/api/prestamos',retry_body,t,201,retry_key)
check('Rejected creation rolls back its request key and can be retried',recovered['cuentaDesembolsoId']==inactive['id'])
active=create()
call('PATCH',f'/api/prestamos/{active}/revisar',token=admin)
call('PATCH',f'/api/prestamos/{active}/aprobar',{},admin)
call('POST',f'/api/prestamos/{active}/desembolsar',{},admin)
pending=create()
Path('.verification/loan-fixture.json').write_text(json.dumps({'email':email,'active':active,'pending':pending,'paid':pid}),encoding='utf-8')
print(f'{len(passed)} loan lifecycle checks passed')
