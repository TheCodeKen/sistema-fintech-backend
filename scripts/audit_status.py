"""Print service health and audit queue age for a selected local Compose project."""
import argparse
import json
import subprocess
import sys
from process_options import background_options

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project',required=True)
parser.add_argument('--max-age-seconds',type=int,default=60)
args=parser.parse_args()
if args.max_age_seconds<0: parser.error('Age threshold must be nonnegative')
compose=['docker','compose','-p',args.project]
report={'project':args.project,'services':{},'outboxes':{},'healthy':True}
ids=subprocess.check_output(compose+['ps','-a','-q'],text=True,**background_options()).split()
containers=json.loads(subprocess.check_output(['docker','inspect',*ids],text=True,**background_options())) if ids else []
states={c['Config']['Labels']['com.docker.compose.service']:c['State'] for c in containers}
for name in ['mysql-db','ms-usuarios','ms-cuentas','ms-transacciones','ms-prestamos','ms-auditoria']:
    state=states.get(name,{})
    health=state.get('Health',{}).get('Status','unknown')
    report['services'][name]={'running':state.get('Running',False),'health':health}
    if not state.get('Running') or health!='healthy': report['healthy']=False
for source in ['usuarios','cuentas','transacciones','prestamos']:
    query=f"SELECT COUNT(*),COALESCE(CAST(MIN(fecha_registro) AS CHAR),''),COALESCE(TIMESTAMPDIFF(SECOND,MIN(fecha_registro),CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','-05:00')),0) FROM fintech_{source}.eventos_pendientes;"
    try:
        result=subprocess.run(compose+['exec','-T','mysql-db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -B -uroot'],
            input=query,text=True,check=True,capture_output=True,**background_options())
        count,oldest,age=result.stdout.strip().split('\t')
        report['outboxes'][source]={'pending':int(count),'oldest':oldest or None,'ageSeconds':max(0,int(age))}
        if int(count) and int(age)>args.max_age_seconds: report['healthy']=False
    except (subprocess.CalledProcessError,ValueError):
        report['outboxes'][source]={'available':False};report['healthy']=False
print(json.dumps(report,indent=2))
sys.exit(0 if report['healthy'] else 1)
