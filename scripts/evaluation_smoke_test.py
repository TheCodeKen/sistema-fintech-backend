"""Internal loan evaluation checks. Seeds demo loans in an explicitly disposable environment."""
import argparse
import json
import runpy
import subprocess
import sys
import uuid
from decimal import Decimal
from datetime import date
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',required=True)
parser.add_argument('--simulate-history',action='store_true',help='Simulate overdue/incomplete schedules only on newly seeded loans in fintech-verificacion')
args=parser.parse_args()
if args.simulate_history and args.url.rstrip('/')!='http://localhost:4300':
    parser.error('History simulation targets the isolated fintech-verificacion environment on localhost:4300')
sys.argv=[str(Path(__file__).with_name('loan_smoke_test.py')),'--url',args.url]
seed=runpy.run_path(sys.argv[0],run_name='__main__')
call=seed['call'];admin=seed['admin'];token=seed['t'];user=seed['u'];candidate=seed['pending'];active=seed['active'];passed=[]

def check(name,condition=True):
    assert condition,name
    passed.append(name)
    print('PASS '+name,flush=True)

path=f'/api/prestamos/{candidate}/evaluacion'
call('GET',path,expected=401)
call('GET',path,token=token,expected=403)
call('GET',path,token=seed['other'],expected=403)
call('GET','/api/prestamos/999999999/evaluacion',token=admin,expected=404)
check('Evaluation is restricted to administrators, including against the loan owner')
for _ in range(22):
    call('POST','/api/prestamos',seed['body'],token,201)
history=call('GET',path,token=admin)
all_loans=call('GET',f"/api/prestamos/usuario/{user['usuarioId']}",token=token)
check('Current application is excluded while historical counts remain complete',history['totalOtrosPrestamos']==len(all_loans)-1 and all(p['id']!=candidate for p in history['prestamosRecientes']))
second=call('GET',path+'?pagina=1',token=admin)
actual_ids={p['id'] for p in history['prestamosRecientes']+second['prestamosRecientes']}
check('Historical loans remain accessible across pages',history['totalPaginasPrestamos']==2 and len(history['prestamosRecientes'])==20 and actual_ids=={p['id'] for p in all_loans if p['id']!=candidate})
call('GET',path+'?pagina=-1',token=admin,expected=400)
check('Actual payments and source references are available',history['totalPagos']==2 and len(history['pagosRecientes'])==2 and all(p['transaccionId'] for p in history['pagosRecientes']))
usd=call('POST','/api/cuentas',{'usuarioId':user['usuarioId'],'tipoCuenta':'AHORROS','moneda':'USD','saldoInicial':0},token,201)
call('PATCH',f"/api/cuentas/{usd['id']}/activar",token=admin)
loan=call('POST','/api/prestamos',dict(seed['body'],cuentaDesembolsoId=usd['id'],moneda='USD'),token,201)
call('PATCH',f"/api/prestamos/{loan['id']}/revisar",token=admin)
call('PATCH',f"/api/prestamos/{loan['id']}/aprobar",{},admin)
call('POST',f"/api/prestamos/{loan['id']}/desembolsar",{},admin)
history=call('GET',path,token=admin)
saldos={s['moneda']:s for s in history['saldos']}
check('PEN and USD debts are kept separate',set(saldos)=={'PEN','USD'} and all(Decimal(str(s['saldoPendiente']))==Decimal('515.07') for s in saldos.values()))
if args.simulate_history:
    def sql(statement):
        return subprocess.check_output(['docker','compose','-p','fintech-verificacion','exec','-T','mysql-db','sh','-c',
            'MYSQL_PWD="$MYSQL_PASSWORD" mysql -N -B -u "$MYSQL_USER" fintech_prestamos -e "$1"','sh',statement],text=True).strip()
    sql(f"UPDATE cuotas_prestamo SET vencimiento=DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-05:00')),INTERVAL 1 DAY) WHERE prestamo_id={int(active)} AND numero=1;")
    original=sql(f"SELECT numero,vencimiento,importe,pagado FROM cuotas_prestamo WHERE prestamo_id={int(loan['id'])} AND numero=3;").split('\t')
    assert len(original)==4
    sql(f"DELETE FROM cuotas_prestamo WHERE prestamo_id={int(loan['id'])} AND numero=3;")
    try:
        before=sql(f"SELECT COUNT(*) FROM cuotas_prestamo WHERE prestamo_id={int(loan['id'])};")
        history=call('GET',path,token=admin)
        pen=next(s for s in history['saldos'] if s['moneda']=='PEN')
        check('Overdue installments use their actual due date and unpaid amount',pen['cuotasVencidas']==1 and Decimal(str(pen['saldoVencido']))==Decimal('171.69'))
        after=sql(f"SELECT COUNT(*) FROM cuotas_prestamo WHERE prestamo_id={int(loan['id'])};")
        check('Incomplete schedules are flagged without reconstructing them during evaluation',history['prestamosSinCronograma']==1 and before==after=='2')
    finally:
        sql(f"INSERT INTO cuotas_prestamo (prestamo_id,numero,vencimiento,importe,pagado) VALUES ({int(loan['id'])},{int(original[0])},'{date.fromisoformat(original[1]).isoformat()}',{Decimal(original[2])},{Decimal(original[3])});")
fresh_email=f'evaluation-new-{uuid.uuid4().hex[:10]}@example.test'
fresh=call('POST','/api/usuarios/registro',{'email':fresh_email,'password':'Prueba123!','nombre':'Cliente','apellido':'Nuevo'},expected=201)
account=call('POST','/api/cuentas',{'usuarioId':fresh['usuarioId'],'tipoCuenta':'AHORROS','moneda':'PEN','saldoInicial':0},fresh['token'],201)
call('PATCH',f"/api/cuentas/{account['id']}/activar",token=admin)
request=call('POST','/api/prestamos',dict(seed['body'],usuarioId=fresh['usuarioId'],cuentaDesembolsoId=account['id']),fresh['token'],201)
empty=call('GET',f"/api/prestamos/{request['id']}/evaluacion",token=admin)
check('A new customer has no fabricated prior loans or payment history',empty['totalOtrosPrestamos']==0 and not empty['saldos'] and empty['totalPagos']==0)
Path('.verification/evaluation-fixture.json').write_text(json.dumps({'email':seed['email'],'candidate':candidate,'active':active,'paid':seed['pid'],'usd':loan['id'],'newCandidate':request['id'],'newEmail':fresh_email}),encoding='utf-8')
print(json.dumps({'passed':len(passed),'seedChecks':len(seed['passed'])},indent=2))
