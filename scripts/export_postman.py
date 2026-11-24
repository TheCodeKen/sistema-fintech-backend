"""Regenerate the reviewable Postman collection from current API contracts."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
items=[]
def add(name,method,path,body=None,test=None):
    request={'method':method,'url':'{{base_url}}'+path,'header':[]}
    if body is not None:
        request['header'].append({'key':'Content-Type','value':'application/json'})
        request['body']={'mode':'raw','raw':json.dumps(body,indent=2,ensure_ascii=False)}
    if path=='/api/transacciones': request['header'].append({'key':'Idempotency-Key','value':'{{operacion_id}}'})
    entry={'name':name,'request':request}
    if test: entry['event']=[{'listen':'test','script':{'type':'text/javascript','exec':test}}]
    items.append(entry)
add('Login (guarda el Bearer)', 'POST','/api/usuarios/login',{'email':'admin@fintech.pe','password':'admin123'},[
    'pm.test("Login correcto", () => pm.response.to.have.status(200));',
    'pm.collectionVariables.set("token", pm.response.json().token);'])
items[-1]['request']['auth']={'type':'noauth'}
add('Usuarios paginados','GET','/api/usuarios?page=0&size=10')
add('Cuentas paginadas','GET','/api/cuentas?page=0&size=10')
add('Crear cuenta pendiente','POST','/api/cuentas',{'usuarioId':'{{usuario_id}}','tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0})
add('Activar cuenta','PATCH','/api/cuentas/{{cuenta_id}}/activar')
add('Mis cuentas','GET','/api/cuentas/usuario/{{usuario_id}}')
add('Nueva operación (conservar operacion_id al reintentar)','POST','/api/transacciones',{'numeroCuentaOrigen':'{{cuenta_origen}}','tipoTransaccion':'TRANSFERENCIA','numeroCuentaDestino':'{{cuenta_destino}}','monto':10,'descripcion':'Prueba Postman'})
add('Transacciones paginadas','GET','/api/transacciones?page=0&size=10')
add('Reversión administrativa','POST','/api/transacciones/{{transaccion_id}}/revertir')
add('Solicitar préstamo','POST','/api/prestamos',{'usuarioId':'{{usuario_id}}','cuentaDesembolsoId':'{{cuenta_id}}','montoSolicitado':500,'tasaInteres':18,'plazoMeses':3,'tipoPrestamo':'PERSONAL','moneda':'PEN'})
add('Revisar préstamo','PATCH','/api/prestamos/{{prestamo_id}}/revisar')
add('Aprobar préstamo','PATCH','/api/prestamos/{{prestamo_id}}/aprobar',{'observacion':'Revisión aprobada'})
add('Desembolsar préstamo','POST','/api/prestamos/{{prestamo_id}}/desembolsar',{})
add('Pagar préstamo (conservar operacion_id al reintentar)','POST','/api/prestamos/{{prestamo_id}}/pagar',{'cuentaId':'{{cuenta_id}}','monto':50,'operacionId':'{{operacion_id}}'})
add('Auditoría','GET','/api/auditoria?page=0&size=20')
add('Alertas','GET','/api/alertas?page=0&size=20')
add('Resolver alerta','PATCH','/api/alertas/{{alerta_id}}/resolver',{'estado':'RESUELTA','observacion':'Revisada por administrador'})
add('Recuperar contraseña','POST','/api/usuarios/password/forgot',{'email':'cliente@fintech.pe'})
items[-1]['request']['auth']={'type':'noauth'}
add('Restablecer contraseña','POST','/api/usuarios/password/reset',{'token':'{{reset_token}}','nuevaPassword':'Nueva123!'})
items[-1]['request']['auth']={'type':'noauth'}
collection={'info':{'name':'FinTechPro — contratos actuales','schema':'https://schema.getpostman.com/json/collection/v2.1.0/collection.json','description':'Entorno de demostración. Cambiar las variables de IDs y conservar operacion_id para un reintento. Generar otra clave para una operación nueva.'},
    'auth':{'type':'bearer','bearer':[{'key':'token','value':'{{token}}','type':'string'}]},
    'variable':[{'key':k,'value':v} for k,v in {'base_url':'http://localhost:4200','token':'','usuario_id':'2','cuenta_id':'1','cuenta_origen':'','cuenta_destino':'','transaccion_id':'1','prestamo_id':'1','alerta_id':'1','operacion_id':'postman-operacion-0001','reset_token':''}.items()], 'item':items}
out=json.dumps(collection,indent=2,ensure_ascii=False)+'\n'
(root/'FinTechPro.postman_collection.json').write_text(out,encoding='utf-8')
print('Updated Postman collection')
