"""Prepare or import the audit schema without removing the previous journal."""
import argparse
import json
import re
import subprocess
from pathlib import Path
from datetime import datetime, timezone

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project',required=True)
parser.add_argument('--prepare',action='store_true')
parser.add_argument('--copy',action='store_true')
parser.add_argument('--report')
args=parser.parse_args()
compose=['docker','compose','-p',args.project,'exec','-T','mysql-db']

def sql(statement):
    result=subprocess.run(compose+['sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -B -uroot'],
        input=statement,text=True,check=True,capture_output=True)
    return result.stdout.strip()

report={'project':args.project,'completedAt':datetime.now(timezone.utc).isoformat()}
if args.prepare:
    user=subprocess.check_output(compose+['printenv','MYSQL_USER'],text=True).strip()
    if not re.fullmatch(r'[A-Za-z0-9_]+',user): raise ValueError('Unsupported application username')
    sql(f"CREATE DATABASE IF NOT EXISTS fintech_auditoria; GRANT ALL PRIVILEGES ON fintech_auditoria.* TO '{user}'@'%';")
    report['schemaPrepared']=True
if args.copy:
    sql("""
        INSERT INTO fintech_auditoria.auditoria
            (evento_id,legacy_id,usuario_ejecutor,rol_ejecutor,accion,entidad_afectada,entidad_id,detalles,fecha_registro,ip_origen)
        SELECT COALESCE(evento_id,CONCAT('legacy:usuarios:',id)),id,usuario_ejecutor,rol_ejecutor,accion,entidad_afectada,
            entidad_id,detalles,fecha_registro,ip_origen FROM fintech_usuarios.auditoria
        ON DUPLICATE KEY UPDATE legacy_id=VALUES(legacy_id);
    """)
    difference=sql("""
        SELECT COUNT(*) FROM fintech_usuarios.auditoria a LEFT JOIN fintech_auditoria.auditoria b
            ON b.evento_id=COALESCE(a.evento_id,CONCAT('legacy:usuarios:',a.id))
        WHERE b.id IS NULL OR NOT(a.id <=> b.legacy_id) OR NOT(BINARY CONVERT(a.usuario_ejecutor USING utf8mb4) <=> BINARY CONVERT(b.usuario_ejecutor USING utf8mb4))
            OR NOT(BINARY CONVERT(a.rol_ejecutor USING utf8mb4) <=> BINARY CONVERT(b.rol_ejecutor USING utf8mb4)) OR NOT(BINARY CONVERT(a.accion USING utf8mb4) <=> BINARY CONVERT(b.accion USING utf8mb4))
            OR NOT(BINARY CONVERT(a.entidad_afectada USING utf8mb4) <=> BINARY CONVERT(b.entidad_afectada USING utf8mb4)) OR NOT(a.entidad_id <=> b.entidad_id)
            OR NOT(BINARY CONVERT(a.detalles USING utf8mb4) <=> BINARY CONVERT(b.detalles USING utf8mb4)) OR NOT(a.fecha_registro <=> b.fecha_registro) OR NOT(BINARY CONVERT(a.ip_origen USING utf8mb4) <=> BINARY CONVERT(b.ip_origen USING utf8mb4));
    """)
    if difference!='0': raise RuntimeError('Historical audit comparison failed; both journals were retained')
    report.update({'sourceRows':int(sql('SELECT COUNT(*) FROM fintech_usuarios.auditoria;')),
        'destinationRows':int(sql('SELECT COUNT(*) FROM fintech_auditoria.auditoria;')),'historicalDifferences':0})
if not (args.prepare or args.copy): parser.error('Select --prepare or --copy')
if args.report: Path(args.report).write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
