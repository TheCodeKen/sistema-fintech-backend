# Auditoría independiente

`ms-auditoria` atiende el diario administrativo en el puerto interno 8085 y conserva sus datos en `fintech_auditoria`. El frontend mantiene `/api/auditoria`, dirigido por Nginx al nuevo servicio. En desarrollo Angular apunta al puerto 8085. En el proyecto aislado `fintech-verificacion` se publica en 8185 y la aplicación sigue en 4300.

## Entrega y recuperación

Usuarios, Cuentas, Transacciones y Préstamos guardan eventos en `eventos_pendientes` dentro de su propia base. Las acciones auditadas y el registro pendiente comparten la transacción local. Usuarios incorpora esta cola mediante Flyway V4. El publicador intenta entregar lotes de hasta 50 eventos cada cinco segundos y elimina únicamente los confirmados.

La recepción `POST /api/auditoria/internal/eventos` requiere `X-Internal-Service`. La credencial se configura en el backend. El receptor inserta el evento y comprueba su contenido bajo un bloqueo transaccional. Reentregar el mismo identificador y contenido responde 204. Un contenido distinto con el mismo identificador responde 409 y conserva el evento original. La precisión temporal se normaliza a los microsegundos que almacena MySQL.

La recepción de eventos funciona con la credencial interna. Las consultas administrativas validan el JWT y la sesión vigente mediante Usuarios. El diario admite lectura administrativa y recepción de eventos a través de sus APIs. Sus endpoints públicos carecen de operaciones de edición o eliminación del historial.

Los errores del publicador registran identificador de evento, tipo de excepción y estado HTTP o `SIN_RESPUESTA`. Un evento rechazado permanece pendiente y puede detener su lote. Debe investigarse el identificador indicado en el log, conservando la evidencia. La pantalla muestra un error explícito de consulta y permite reintentar cuando el servicio se recupera.

## Actualización de un volumen existente

Ejecutar desde la raíz del repositorio y conservar los puertos del proyecto elegido. Para el entorno aislado utilizado aquí, en PowerShell:

```powershell
$env:MYSQL_PORT='3407'
$env:PORT_8081='8181'; $env:PORT_8082='8182'
$env:PORT_8083='8183'; $env:PORT_8084='8184'; $env:PORT_8085='8185'
$env:FRONTEND_PORT='4300'; $env:MAIL_UI_PORT='8125'
$env:PASSWORD_RESET_FRONTEND_URL='http://localhost:4300/reset-password'
$stack=@('compose','-p','fintech-verificacion','-f','docker-compose.yml','-f','docker-compose.ollama.yml','-f','docker-compose.ollama.gpu.yml')

python scripts/migrate_audit.py --project fintech-verificacion --prepare
docker @stack up -d --build --wait ms-auditoria ms-usuarios ms-cuentas ms-transacciones ms-prestamos frontend-angular
python scripts/migrate_audit.py --project fintech-verificacion --copy --report .verification/audit-migration.json
```

`--prepare` crea el esquema y concede acceso al usuario de aplicación existente. Los volúmenes nuevos también reciben el esquema desde `init-db.sql`. Los scripts de inicialización de MySQL se ejecutan al crear un volumen y la preparación explícita cubre la actualización de los existentes.

`--copy` importa `fintech_usuarios.auditoria` y compara sus campos con el destino, incluyendo mayúsculas, acentos, fechas e IP. El identificador del evento se conserva. Los registros anteriores que carecen de él reciben `legacy:usuarios:<id>`. El identificador antiguo queda en `legacy_id`; el diario central asigna su propio `id`. La importación se puede repetir. La tabla anterior se conserva como archivo verificable y las nuevas acciones se entregan por los outboxes.

Durante una actualización por etapas se puede importar una primera copia antes de cambiar los productores y repetir la comparación después de actualizar Usuarios. El informe final debe indicar cero diferencias históricas.

## Compatibilidad

Los clientes anteriores dirigidos a Usuarios conservan estas rutas:

- `GET /api/auditoria` delega al servicio independiente, con autorización de administrador.
- `POST /api/auditoria/internal/eventos` conserva el identificador y encola la entrega, respondiendo 204.
- `POST /api/auditoria/internal` pasa a responder **202 Accepted** con `eventoId`; su `id` central queda pendiente de asignación. La acción ya está guardada en la cola de Usuarios.

Los productores actualizados usan directamente el receptor de eventos de `ms-auditoria`. El endpoint `/internal` del servicio central mantiene la recepción síncrona anterior para clientes internos autenticados. Para reintentos deduplicados se utiliza `/internal/eventos` conservando el identificador original.

## Estado y pruebas de caída

```powershell
python scripts/audit_status.py --project fintech-verificacion
python scripts/audit_resilience_test.py --project fintech-verificacion --url http://localhost:4300
```

El estado informa salud de los procesos, cantidad de eventos pendientes y antigüedad de la cola por productor. Devuelve código 1 ante servicios detenidos, comprobaciones de salud fallidas, base inaccesible o colas con antigüedad superior al umbral. El umbral es configurable con `--max-age-seconds` y por defecto vale 60. Es una comprobación puntual que puede programarse en un monitor.

La prueba de resiliencia crea usuarios, cuentas, fondos y préstamos de demostración. Comprueba los puertos del frontend para identificar el proyecto seleccionado, detiene Auditoría, realiza y reintenta una transferencia, genera eventos desde los cuatro productores y reinicia Cuentas. Recupera Auditoría en `finally` y verifica la entrega y retirada de todos los eventos pendientes. Debe ejecutarse en un entorno desechable.

## Respaldo comprobable

```powershell
python scripts/backup_audit.py --project fintech-verificacion --output .verification/backups/auditoria.sql --verify-restore
```

El respaldo usa `mysqldump --single-transaction` y registra SHA-256. La verificación restaura el archivo en un esquema temporal generado, compara sus registros con el diario activo y retira ese esquema temporal. El respaldo y su informe permanecen en el directorio indicado. `.verification` está excluido de Git.

Esta copia local cubre el esquema de Auditoría. La recuperación ante pérdida del equipo o del disco requiere conservar respaldos fuera del mismo almacenamiento. Los respaldos del resto de las bases requieren su propia planificación y pruebas de restauración.

## Alcance del aislamiento

La programación de respaldos, el monitoreo y la configuración pendiente de nube y correo están documentados en [OPERACIONES.md](OPERACIONES.md).

La caída del proceso de Auditoría puede acumular eventos pendientes mientras continúan las operaciones de los productores. El MySQL y el equipo Docker siguen compartidos. La autenticación de usuarios sigue dependiendo de Usuarios. Los `healthcheck` permiten detectar indisponibilidad; `restart: unless-stopped` actúa cuando termina un proceso, mientras que un contenedor detenido manualmente se recupera mediante `docker compose start`.

No se configura un canal automático de avisos operativos ni almacenamiento de respaldos externo en esta etapa. La extracción de Riesgo y Alertas queda como una evolución independiente.
