"""AI integration checks. Default checks unavailable state; simulated-provider mode requires disposable localhost:4300."""
import argparse,json,uuid
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',required=True);parser.add_argument('--simulated-provider',action='store_true');parser.add_argument('--fixture');args=parser.parse_args();base=args.url.rstrip('/');passed=[]
if args.simulated_provider and base!='http://localhost:4300':parser.error('Simulated mode is restricted to localhost:4300')
def call(method,path,data=None,token=None,key=None,expected=200):
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    if key:headers['Idempotency-Key']=key
    try:
        with urlopen(Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method),timeout=70) as r:status=r.status;raw=r.read()
    except HTTPError as e:status=e.code;raw=e.read()
    assert status==expected,f'{method} {path}: expected {expected}, got {status}: {raw[:250]}'
    return json.loads(raw) if raw else None
def check(name,condition=True):assert condition,name;passed.append(name);print('PASS '+name,flush=True)
def chat(token,question,datos=False,modo='CLIENTE',expected=200):return call('POST','/api/usuarios/asistente/chat',{'mensaje':question,'modo':modo,'consultarDatos':datos,'historial':[]},token,expected=expected)
call('GET','/api/usuarios/asistente/estado',expected=401);call('POST','/api/usuarios/asistente/chat',{'mensaje':'Hola','modo':'CLIENTE'},expected=401);check('Assistant endpoints require authentication')
admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
estado=call('GET','/api/usuarios/asistente/estado',token=admin);check('Status never reveals API credential',{'disponible','proveedor','administrador'}.issubset(estado) and not any('key' in k.lower() for k in estado))
if not args.simulated_provider:
    if not estado['disponible']:chat(admin,'Guíame con un formulario',expected=503);check('Missing provider configuration returns explicit unavailable status')
    print(json.dumps({'passed':len(passed),'realModelCalled':False}));raise SystemExit(0)
with urlopen('http://localhost:8799',timeout=5) as r:stats=json.load(r)
assert 'storeEnabled' in stats,'Local test double must be running; never run this suite against real OpenAI'
assert estado['disponible'],'Simulated provider is not configured'
suffix=uuid.uuid4().hex[:10]
def user(n):return call('POST','/api/usuarios/registro',{'email':f'ai-{suffix}-{n}@example.test','password':'Prueba123!','nombre':'Prueba','apellido':'IA'},expected=201)
u=user(1);v=user(2);t=u['token'];other=v['token']
def account(who):
    c=call('POST','/api/cuentas',{'usuarioId':who['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},who['token'],expected=201);call('PATCH',f"/api/cuentas/{c['id']}/activar",token=admin);return c
c=account(u);d=account(v)
def deposit(c,token):return call('POST','/api/transacciones',{'numeroCuentaOrigen':c['numeroCuenta'],'tipoTransaccion':'DEPOSITO','monto':100,'descripcion':'Datos de demostracion IA'},token,str(uuid.uuid4()),201)
own_tx=deposit(c,t);foreign_tx=deposit(d,other)
before=call('GET',f"/api/cuentas/{c['id']}",token=t)['saldo']
chat(t,'Resume alertas',True,'ADMIN',403);check('Client cannot select administrative assistant')
chat(t,'forzar admin',True,expected=403);check('Model-generated administrative tool is denied for clients')
chat(t,'Resume mis cuentas',False,expected=403);check('Data lookup is denied when user did not enable it')
r=chat(t,f"Resume mis cuentas. Mi correo es ai-{suffix}-1@example.test y mi cuenta {c['numeroCuenta']}",True)
check('Client reads authorized masked account data and verified source',r['datosConsultados'] and '****' in r['respuesta'] and c['numeroCuenta'] not in r['respuesta'] and any(f['enlace']=='/cuentas' for f in r['fuentes']))
r=chat(t,'Guíame para hacer una transferencia');check('Guidance works without financial data permission',not r['datosConsultados'] and bool(r['fuentes']))
chat(t,f"Explica el movimiento #{foreign_tx['id']}",True,expected=403);check('Foreign record lookup is denied by the owning service')
chat(t,'ejecutar transferencia',True,expected=403);check('Write tools do not exist and account balance is unchanged',call('GET',f"/api/cuentas/{c['id']}",token=t)['saldo']==before)
chat(t,'Otra consulta',expected=429);check('Per-user request limit enforced')
chat(other,'fallo proveedor',expected=503);chat(other,'respuesta incompleta',expected=502);check('Provider failures and incomplete outputs are explicit errors')
r=chat(other,f"Explica el movimiento #{foreign_tx['id']}",True);check('Authorized movement explanation links its original record',any(f['enlace']==f"/transacciones/{foreign_tx['id']}" for f in r['fuentes']))
r=chat(admin,'Resume las alertas pendientes',True,'ADMIN');check('Administrator can summarize authorized alerts',r['modo']=='ADMIN' and any(f['enlace']=='/alertas' for f in r['fuentes']))
r=chat(admin,'¿Qué solicitudes necesitan revisión?',True,'ADMIN');check('Administrator can summarize loan requests',any(f['enlace']=='/prestamos' for f in r['fuentes']))
r=chat(admin,'Dame un resumen operativo',True,'ADMIN');check('Administrator operational summary uses verified sources',any(f['enlace']=='/dashboard' for f in r['fuentes']))
call('POST','/api/usuarios/asistente/chat',{'mensaje':'x'*1201,'modo':'CLIENTE'},other,expected=400);check('Input length validated')
with urlopen('http://localhost:8799',timeout=5) as response:stats=json.load(response)
check('Outbound payloads omit unmasked accounts, emails and JWTs and request store=false',not any(stats[k] for k in ['unmaskedAccount','emailInPayload','jwtInPayload','storeEnabled']))
if args.fixture:Path(args.fixture).write_text(json.dumps({'email':f'ai-{suffix}-2@example.test','movement':foreign_tx['id']}),encoding='utf-8')
print(json.dumps({'passed':len(passed),'realModelCalled':False,'provider':'local Responses test double'},indent=2))
