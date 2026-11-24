# Respaldos programados y monitoreo

## Estado de esta instalación

El proyecto aislado `fintech-verificacion` tiene registrada la tarea de Windows `FinTech-Operations-fintech-verificacion`. Cada cinco minutos ejecuta `scripts/operations.py`, comprueba la salud de los seis servicios de datos/backend y la antigüedad de los eventos pendientes. Crea un respaldo de Auditoría cuando han transcurrido 24 horas desde la última copia correcta, o en la primera ejecución. Los cambios de estado quedan en un registro local.

La tarea usa el usuario actual, con permisos normales y sesión iniciada. Docker Desktop debe estar arrancado. Al volver a estar disponible, se intenta la ejecución pendiente. Un equipo apagado no puede generar sus propios avisos: para detectar la pérdida completa del equipo se requiere además un monitor externo con comprobación de latido.

En Windows la tarea utiliza `pythonw.exe` y los procesos secundarios usan `CREATE_NO_WINDOW`. Así el monitoreo y los respaldos funcionan sin abrir ventanas de consola. El resultado se consulta en `status.json`, los registros locales y el historial de la tarea.

**Configuración externa pendiente:** el bucket y el SMTP aún no están configurados. `status.json` indica `offsite_not_configured` y `notifications_not_configured`, y el proceso devuelve 1. Esto distingue una instalación incompleta de un entorno totalmente protegido, aunque los servicios estén saludables. No se ha enviado información a la nube ni correo real.

## Archivos y ejecución manual

La configuración activa está en `.verification/operations-config.json`; el ejemplo versionado es `scripts/operations.example.json`. El estado, los incidentes y las copias locales están en `.verification/operations/` (excluido de Git).

```powershell
python scripts/operations.py --config .verification/operations-config.json
python scripts/operations.py --config .verification/operations-config.json --force-backup
Get-ScheduledTaskInfo -TaskName FinTech-Operations-fintech-verificacion
Get-Content .verification/operations/status.json
```

El código 0 indica comprobación completa correcta; 1 indica incidencias o configuración externa pendiente; 2 indica que no se pudo iniciar la comprobación. `checkedAt` permite comprobar la frescura del estado. No debe interpretarse un informe antiguo como salud actual.

Para reinstalar la tarea desde la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install_operations_task.ps1 -ConfigPath .verification/operations-config.json
```

Se sobrescribe únicamente la tarea con el nombre correspondiente al proyecto configurado. El bloqueo del script y `MultipleInstances=IgnoreNew` evitan trabajos simultáneos. Para desactivarla:

```powershell
Disable-ScheduledTask -TaskName FinTech-Operations-fintech-verificacion
```

## Destino externo recomendado

Se recomienda un bucket privado de Backblaze B2, con una clave restringida al bucket, y un remoto `crypt` de rclone para cifrar los datos antes de salir del equipo. Mantener la contraseña y la configuración de recuperación en un lugar independiente del equipo y del bucket. El cifrado no sustituye un respaldo de las claves: perderlas impide recuperar los archivos.

1. Crear la cuenta y el bucket privado; revisar cuotas y presupuesto antes de activar transferencias.
2. Instalar rclone desde su distribución oficial bajo el mismo usuario que ejecuta la tarea.
3. Ejecutar `rclone config` para crear el remoto B2 y un remoto `crypt`, por ejemplo `fintech-crypt`, apuntando a una carpeta dedicada del bucket.
4. En la configuración local, establecer `"rclone": "ruta absoluta a rclone.exe"` y `"remote": "fintech-crypt:auditoria"`. Las credenciales pertenecen a la configuración privada de rclone, fuera del repositorio. Si se cifra esa configuración, preparar su desbloqueo no interactivo bajo el usuario de la tarea mediante los mecanismos de rclone.
5. Ejecutar una comprobación manual y verificar `lastOffsiteAt`. El programa copia las carpetas completas con `--immutable` y luego ejecuta `rclone check --download --one-way`: la fecha de entrega solo se registra después de verificar la copia remota.
6. Descargar una copia desde otro equipo y ensayar su restauración en una instancia MySQL de prueba. La comprobación de descarga e integridad no sustituye esta prueba de recuperación externa.

Documentación oficial: [claves B2](https://www.backblaze.com/docs/en/cloud-storage-application-keys), [cifrado B2](https://www.backblaze.com/docs/cloud-storage-server-side-encryption), [rclone crypt](https://rclone.org/crypt/) y [verificación rclone](https://rclone.org/commands/rclone_check/).

Una ruta de disco local no se acepta como remoto externo. Un remoto rclone debe apuntar realmente a almacenamiento independiente: darle un nombre a un disco del mismo equipo no lo convierte en una copia externa.

## Avisos por correo

Usar un SMTP real con STARTTLS y una cuenta remitente dedicada; Mailpit es el receptor de desarrollo. Configurar localmente:

```json
"smtp": {
  "host": "smtp.del-proveedor.example",
  "port": 587,
  "from": "monitor@dominio.example",
  "to": "operador@dominio.example",
  "user": "monitor@dominio.example",
  "passwordEnv": "FINTECH_SMTP_PASSWORD"
}
```

La contraseña se configura fuera del código en el entorno del usuario que ejecuta la tarea. Reiniciar su sesión si cambia el entorno persistente. Nunca escribirla en el JSON, en Git ni en el chat. El script exige TLS y valida el certificado. Un cambio de incidencia envía un aviso y la recuperación envía otro; las incidencias sin cambios no generan mensajes repetidos. Un envío fallido se vuelve a intentar en la siguiente ejecución. El informe local registra el fallo sin publicar las credenciales ni las respuestas del proveedor.

## Integridad, retención y alcance

Cada respaldo usa el procedimiento de [AUDITORIA.md](AUDITORIA.md): instantánea transaccional, SHA-256, restauración en un esquema temporal y comparación de los registros. Se publica una carpeta completa solo cuando termina la verificación; los archivos temporales fallidos se retiran.

La retención local es de 14 copias completas por defecto, con un mínimo de siete. Solo se retiran directorios con el formato generado por este programa dentro del directorio de respaldos. Si hay remoto configurado y falla una entrega, se conservan las copias pendientes; al recuperarse se intentan todas. Esto puede aumentar el consumo local durante una indisponibilidad larga y requiere vigilar el espacio. Los registros de incidentes rotan al superar 1 MB.

El programa no borra copias remotas. Configurar una política de conservación en el bucket acorde al presupuesto y al plazo de recuperación; es independiente de la retención local.

Esta etapa respalda **el esquema de Auditoría**. Para recuperar toda la aplicación también se necesitan respaldos y pruebas de restauración de Usuarios, Cuentas, Transacciones y Préstamos, además de configuración, secretos y claves de cifrado. El monitoreo es local y puntual; no aporta conmutación automática ni detecta desde fuera una caída completa del host.

## Validación

Las pruebas `python -m unittest discover -s scripts -p test_operations.py -v` cubren errores de Docker, respaldo incompleto, reintento de entrega, verificación remota fallida, retención, preservación de archivos ajenos, bloqueo entre ejecuciones, avisos sin repetición y recuperación. Se integraron en CI.

Se comprobó el respaldo con MySQL real y se detuvo únicamente Auditoría en `fintech-verificacion` para verificar detección y recuperación. Los ensayos de nube y SMTP se simulan hasta disponer de las cuentas: no deben darse por validados contra un proveedor real.
