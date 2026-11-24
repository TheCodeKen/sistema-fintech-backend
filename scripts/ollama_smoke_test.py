"""Real local-model checks. Creates demonstration users/funds; disposable environments only."""
import argparse,json,uuid,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',required=True);parser.add_argument('--fixture');args=parser.parse_args();base=args.url.rstrip('/');passed=[]
def call(method,path,data=None,token=None,key=None,expected=200):
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    if key:headers['Idempotency-Key']=key
    try:
        with urlopen(Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method),timeout=70) as response:status=response.status;raw=response.read()
    except HTTPError as e:status=e.code;raw=e.read()
    allowed=expected if isinstance(expected,tuple) else (expected,)
    assert status in allowed,f'{method} {path}: expected {allowed}, got {status}: {raw[:300]}'
    return json.loads(raw) if raw else None
def check(name,condition=True):assert condition,name;passed.append(name);print('PASS '+name,flush=True)
def chat(token,message,datos=False,mode='CLIENTE',expected=200):
    start=time.monotonic();result=call('POST','/api/usuarios/asistente/chat',{'mensaje':message,'modo':mode,'consultarDatos':datos,'historial':[]},token,expected=expected)
    print('Local inference finished in %.1fs'%(time.monotonic()-start),flush=True);return result
call('GET','/api/usuarios/asistente/estado',expected=401);check('Assistant requires authentication')
admin=call('POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'})['token']
state=call('GET','/api/usuarios/asistente/estado',token=admin)
check('Actual downloaded local model is available',state['disponible'] and state['procesamientoLocal'] and state['proveedor']=='Ollama local')
suffix=uuid.uuid4().hex[:10];email=f'ollama-{suffix}@example.test'
u=call('POST','/api/usuarios/registro',{'email':email,'password':'Prueba123!','nombre':'Prueba','apellido':'Local'},expected=201);token=u['token']
account=call('POST','/api/cuentas',{'usuarioId':u['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},token,expected=201)
call('PATCH',f"/api/cuentas/{account['id']}/activar",token=admin)
call('POST','/api/transacciones',{'numeroCuentaOrigen':account['numeroCuenta'],'tipoTransaccion':'DEPOSITO','monto':100,'descripcion':'Prueba IA local'},token,str(uuid.uuid4()),201)
chat(token,'Resume las alertas pendientes',True,'ADMIN',403);check('Client cannot select admin agent')
guide=chat(token,'Guíame para hacer una transferencia en esta aplicación.')
check('Real model explains transfer form with verified guide',bool(guide['respuesta'].strip()) and not guide['datosConsultados'] and any(f['enlace']=='/transacciones' for f in guide['fuentes']))
accounts=chat(token,'Consulta mis cuentas e indica el saldo en PEN de la cuenta, sin inventar datos.',True)
check('Real model reads only authorized account data',accounts['datosConsultados'] and any(f['enlace']=='/cuentas' for f in accounts['fuentes']) and account['numeroCuenta'] not in accounts['respuesta'])
alerts=chat(admin,'Consulta las alertas pendientes y resume cuáles necesitan revisión. No ejecutes acciones.',True,'ADMIN')
check('Real admin agent summarizes existing alerts',alerts['datosConsultados'] and any(f['enlace']=='/alertas' for f in alerts['fuentes']))
requests=chat(admin,'Consulta las solicitudes de préstamos pendientes o en revisión y resume su situación.',True,'ADMIN')
check('Real admin agent summarizes loan requests',requests['datosConsultados'] and any(f['enlace']=='/prestamos' for f in requests['fuentes']))
balance=call('GET',f"/api/cuentas/{account['id']}",token=token)['saldo']
check('AI queries do not move money',balance==100)
for result in [guide,accounts,alerts,requests]:
    assert len(result['respuesta'])<=6000 and all(f['enlace'].startswith('/') and not f['enlace'].startswith('//') for f in result['fuentes'])
check('Responses and source links remain bounded and internal')
if args.fixture:Path(args.fixture).write_text(json.dumps({'email':email,'accountId':account['id'],'guide':guide['respuesta'],'accounts':accounts['respuesta'],'adminAlerts':alerts['respuesta'],'adminRequests':requests['respuesta']},ensure_ascii=False),encoding='utf-8')
print(json.dumps({'passed':len(passed),'provider':'Ollama local','realModelCalled':True},indent=2))
