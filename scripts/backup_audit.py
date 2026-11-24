"""Back up the audit schema and optionally prove restoration in a temporary schema."""
import argparse
import hashlib
import json
import re
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from process_options import background_options

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project',required=True)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--verify-restore',action='store_true')
args=parser.parse_args()
compose=['docker','compose','-p',args.project,'exec','-T','mysql-db']

def sql(statement):
    result=subprocess.run(compose+['sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -B -uroot'],
        input=statement,text=True,capture_output=True,check=True,**background_options())
    return result.stdout.strip()

args.output.parent.mkdir(parents=True,exist_ok=True)
with args.output.open('wb') as output:
    subprocess.run(compose+['sh','-c',
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 fintech_auditoria'],
        stdout=output,stderr=subprocess.PIPE,check=True,**background_options())
content=args.output.read_bytes()
report={'project':args.project,'createdAt':datetime.now(timezone.utc).isoformat(),'file':str(args.output),
        'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest(),'restoreVerified':False}
if args.verify_restore:
    if re.search(rb'(?im)^\s*(USE\s|CREATE\s+DATABASE|DROP\s+DATABASE)',content):
        raise RuntimeError('Restore verification requires a dump without database-selection statements')
    temporary='fintech_audit_restore_'+uuid.uuid4().hex[:12]
    assert re.fullmatch(r'fintech_audit_restore_[a-f0-9]{12}',temporary)
    sql(f'CREATE DATABASE {temporary};')
    try:
        subprocess.run(compose+['sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$1"','sh',temporary],
            input=content,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,**background_options())
        restored=int(sql(f'SELECT COUNT(*) FROM {temporary}.auditoria;'))
        comparisons=' OR '.join(f'NOT(BINARY CONVERT(r.{column} USING utf8mb4) <=> BINARY CONVERT(s.{column} USING utf8mb4))' for column in
            ['id','legacy_id','usuario_ejecutor','rol_ejecutor','accion','entidad_afectada','entidad_id','detalles','fecha_registro','ip_origen'])
        differences=int(sql(f'SELECT COUNT(*) FROM {temporary}.auditoria r LEFT JOIN fintech_auditoria.auditoria s ON s.evento_id=r.evento_id WHERE s.id IS NULL OR {comparisons};'))
        if differences: raise RuntimeError('Restored audit rows differ from the current journal')
        report.update({'restoreVerified':True,'restoredRows':restored,'differences':differences})
    finally:
        sql(f'DROP DATABASE {temporary};')
args.output.with_suffix(args.output.suffix+'.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
