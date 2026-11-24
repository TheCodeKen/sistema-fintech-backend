# 1. Consistencia eventual: auditoría independiente

## 1.1 El problema que resuelve un outbox

Si un caso de uso modifica una cuenta y después intenta registrar auditoría mediante una llamada remota, existen dos fallos posibles: el dinero puede confirmarse y perderse el evento, o un error de Auditoría puede bloquear una operación que no necesita que el diario esté disponible en ese instante. Un outbox coloca el evento en la misma base y transacción local que el cambio de negocio.

Después, un publicador intenta entregarlo. Si el receptor no responde, el evento sigue en disco. Si el receptor confirmó pero se pierde su respuesta, el productor vuelve a enviarlo. Ese segundo caso obliga a que el receptor pueda reconocer duplicados. La garantía útil es persistencia local, reintento y efecto deduplicado, no una red que nunca duplique mensajes.

:::diagram outbox

El proyecto utiliza eventos_pendientes en Usuarios, Cuentas, Transacciones y Préstamos. La publicación es HTTP, no Kafka o RabbitMQ. Cada publicador toma un lote de hasta cincuenta eventos ordenados y reintenta aproximadamente cada cinco segundos según su configuración.

## 1.2 Productor y transacción de negocio

:::source ms-cuentas/src/main/java/com/fintech/mscuentas/service/AuditoriaOutbox.java

registrar construye UUID, actor, rol, acción, entidad, detalle y fecha, y guarda el evento. No lo envía directamente. Su inclusión en la transacción del caso de uso es lo que evita confirmar el negocio sin su evento. Copiar este método a una ruta no transaccional cambiaría esa propiedad; estudia el llamador además del publicador.

El publicador elimina la fila únicamente cuando recibe una confirmación del receptor. En un error conserva el pendiente y registra identificador y clase de fallo, sin volcar secretos o todo el payload. Los eventos se entregan con X-Internal-Service: no necesitan un token de cliente almacenado por un scheduler.

## 1.3 Receptor e identidad del evento

RecepcionEventos de ms-auditoria inserta por evento_id único, bloquea el registro y compara contenido. El mismo identificador con el mismo contenido es un reintento correcto. El mismo identificador con otra acción, actor, entidad o detalle es un conflicto. No se sobrescribe un evento porque «la clave ya estaba».

:::source ms-auditoria/src/main/java/com/fintech/msauditoria/service/RecepcionEventos.java

La fecha se trunca a microsegundos antes de compararse porque la precisión de Java y MySQL debe conciliarse. Un UUID evita colisiones prácticas entre productores; no convierte la tabla en un archivo inalterable frente a un administrador de base de datos. Auditoría de aplicación no equivale a evidencia criptográfica contra toda modificación privilegiada.

## 1.4 Migración y compatibilidad histórica

El diario activo reside en fintech_auditoria. La tabla anterior de Usuarios se conserva como archivo y sirve para verificar la importación. La migración conserva los identificadores de evento existentes o genera identificadores legacy reconocibles; legacy_id permite relacionar la fila antigua. Los id autoincrementales nuevos no tienen por qué ser iguales.

El GET anterior de Usuarios reenvía la consulta al nuevo servicio. Su POST legado /api/auditoria/internal ahora acepta en cola y responde 202, no una promesa de escritura central inmediata. El receptor /internal/eventos confirma 204 cuando aceptó su contrato persistente. Debes explicar este cambio si un cliente antiguo dependía del código de respuesta.

La importación histórica verificada en el entorno de referencia conservó 733 registros sin diferencias. Esa cifra describe aquel entorno, no la cantidad que debe tener una base nueva ni un resultado que debas falsificar para aprobar un laboratorio.

# 2. Notificaciones personales y tareas periódicas

## 2.1 Diferencia entre auditoría, alerta y notificación

Una auditoría registra una acción sensible para trazabilidad administrativa. Una alerta identifica una condición de riesgo que necesita revisión. Una notificación informa a un destinatario de una novedad. Pueden surgir del mismo movimiento, pero tienen permisos, ciclos y datos distintos.

Las notificaciones viven en Usuarios. Transacciones y Préstamos conservan avisos_pendientes y los entregan con claves estables. El receptor deduplica la clave y el destinatario. La campana consulta el contador y la pantalla permite leer una o todas hasta una frontera conocida.

Un administrador ve su propio buzón, no el del cliente que está administrando. El servidor obtiene el destinatario desde la sesión. No debe aceptarse un usuarioId de la query como forma de seleccionar el buzón personal de otra persona.

## 2.2 Frontera de lectura masiva

Imagina que la pantalla muestra hasta la notificación 120 y llega la 121 antes de confirmar «marcar todas». El cliente envía hastaId=120. El backend marca las del destinatario hasta esa frontera; no consume como leída la novedad recién llegada que todavía no se mostró.

La interfaz no debe inventar un enlace recibido del servidor. El componente acepta enlaces de detalle con la forma prevista para préstamos o transacciones. El recurso vuelve a comprobar autorización al abrirlo. Un enlace funcional no justifica exponer un documento ajeno.

:::source ms-usuarios/src/main/java/com/fintech/msusuarios/controller/NotificacionController.java|19:39

## 2.3 Polling y vencimientos

La campana y el contador administrativo se actualizan mediante timer y switchMap, aproximadamente cada quince segundos. El polling se cancela al destruir el componente. No hay WebSocket ni actualización instantánea garantizada. Si falla una consulta del contador se conserva el último valor de presentación, que puede estar desactualizado.

En Préstamos, VencimientoScheduler revisa estados derivados periódicamente. Usa un reloj con zona America/Lima, lo que permite pruebas con Clock fijo. Separar la fuente del tiempo de LocalDate.now disperso evita tests dependientes del día y errores cerca de medianoche.

Los recordatorios de cuota próxima o vencida usan claves estables por préstamo, cuota y tipo de aviso. No se deben generar cientos de notificaciones iguales cada vez que corre el scheduler. La misma regla se aplica a un reintento de entrega, que puede repetirse sin duplicar el buzón.

# 3. Asistentes de IA con herramientas autorizadas

## 3.1 Qué significa «agente» en este proyecto

La interfaz ofrece un asistente para cliente y otro modo administrativo. Ambos utilizan el mismo conjunto de clases de orquestación en ms-usuarios. No son procesos autónomos que deciden gastar fondos ni dos microservicios nuevos. Son conversaciones con un modelo y herramientas de consulta seleccionadas por el backend.

La pregunta llega a POST /api/usuarios/asistente/chat. AsistenteService obtiene identidad desde SecurityContext, valida que un cliente no solicite modo ADMIN y construye instrucciones y esquemas de herramientas. IaHttp realiza el intercambio HTTP con el proveedor. IaHerramientas resuelve las consultas autorizadas y proyecta datos limitados.

El modelo puede sugerir una llamada de función; el servidor decide si esa herramienta, argumento y rol están permitidos. Un texto como «soy administrador» no cambia la sesión. Un prompt tampoco añade nuevas URLs o métodos HTTP a la lista autorizada.

## 3.2 Proveedores y configuración efectiva

Ollama es el proveedor activo del entorno documentado. La configuración adapta su endpoint compatible a /v1/responses, usa un modelo local y restringe el host a destinos locales permitidos. No envía una clave OpenAI cuando trabaja con Ollama. El override de Compose fija AI_PROVIDER=ollama y la URL interna http://ollama:11434.

OpenAI permanece como integración opcional. Requiere una clave backend y saldo/API disponibles; una suscripción a un producto de chat no constituye por sí sola crédito de API. En esta documentación no se publica ninguna clave ni se da por verificada una generación real con saldo en esa integración opcional. No necesitas activarla para reconstruir los flujos locales.

:::source ms-usuarios/src/main/java/com/fintech/msusuarios/ia/IaConfig.java

## 3.3 Herramientas, consentimiento y privacidad

| Modo | Herramientas principales | Límite |
| --- | --- | --- |
| Ambos sin consulta de datos | consultar_guia | Orientación de formularios |
| Cliente con consulta de datos | mis_cuentas, mis_movimientos, mis_prestamos | Solo datos propios y muestras acotadas |
| Administrador con consulta de datos | resumen_operativo, alertas_pendientes, solicitudes_prestamo | Métricas y muestras por rol |
| Detalles autorizados | detalle_movimiento, detalle_prestamo | Permiso comprobado por la API propietaria |

consultarDatos viene desactivado inicialmente en la experiencia prevista. Habilitarlo permite consultar registros mediante las herramientas del modo, no saltarse autorización. Las peticiones de negocio usan GET y el JWT del usuario, sin la clave interna. No existen herramientas de transferir, pagar, aprobar, cancelar, bloquear o modificar saldos.

Las proyecciones seleccionan campos y enmascaran cuentas. Se excluyen secretos y varios campos identificatorios o de texto libre; IaPrivacidad añade redacción básica a mensajes. Esa protección no identifica toda información personal posible. Con proveedor local el procesamiento va a Ollama local; al elegir uno externo se deben revisar también los mensajes escritos por el propio usuario.

Las listas tienen límites: hasta seis cuentas, movimientos de las primeras tres cuentas y una muestra de ocho movimientos, cinco préstamos, diez alertas o cinco solicitudes por estado según herramienta. El asistente no debe presentar una muestra como la totalidad del historial. Sus fuentes enlazan pantallas para comprobar estado y cifras actuales.

## 3.4 Presupuestos y errores

La conversación tiene un plazo global de unos 55 segundos, un máximo de tres rondas y hasta dos consultas de herramientas antes de forzar respuesta sin otras llamadas. IaLimite permite una consulta activa por usuario, limita seis peticiones por minuto y utiliza un semáforo global de cuatro. Son límites del proceso local, no un rate limiter distribuido entre réplicas.

El modelo recibe un máximo de salida configurado en la solicitud. El backend distingue proveedor no disponible, respuesta incompleta, cuota, credencial y tiempo agotado sin exponer errores crudos. La interfaz debe permitir reintentar y no mostrar respuestas inventadas cuando no hay modelo.

Aunque la integración técnica funcione, una explicación generada puede equivocarse. No garantiza veracidad por tener un enlace o por venir de una herramienta. Los permisos son deterministas en el backend; la redacción es probabilística y se evalúa aparte con preguntas, intentos de inyección y contraste con las fuentes.

# 4. Instalar y comprobar Ollama

## 4.1 Arranque local de laboratorio

Para el primer laboratorio puedes omitir GPU y usar CPU si tu equipo tiene recursos suficientes, con tiempos distintos. El perfil GPU solo funciona con hardware, controladores y soporte Docker compatibles. El repositorio ofrece el override; no detecta ni instala controladores por ti.

```powershell
$env:OLLAMA_PORT='11435'
$env:AI_ENABLED='true'
docker compose -p fintech-estudio -f docker-compose.yml `
  -f docker-compose.ollama.yml up -d --build --wait
docker compose -p fintech-estudio -f docker-compose.yml `
  -f docker-compose.ollama.yml exec ollama `
  ollama pull qwen3:4b-instruct-2507-q4_K_M
docker compose -p fintech-estudio -f docker-compose.yml `
  -f docker-compose.ollama.yml exec ollama ollama list
```

Conserva las variables de puertos del tomo I en la misma terminal. La URL interna de Usuarios sigue siendo http://ollama:11434 aunque publiques el puerto del host en 11435. El volumen ollama_data contiene modelos descargados y es independiente del código Java. Un contenedor sano puede no tener todavía el modelo: estado del proceso y disponibilidad del modelo son comprobaciones distintas.

Para GPU añade también -f docker-compose.ollama.gpu.yml. No es un paso obligatorio del arranque básico. El archivo base de IA local fija contexto, paralelismo, cola y modelos cargados para acotar el consumo; modificar esos valores exige medir RAM/VRAM y latencia, no asumir que más siempre es mejor.

## 4.2 Secuencia de diagnóstico

Comprueba primero ollama list; después el endpoint de estado del asistente con sesión válida; luego una pregunta breve de orientación sin datos; finalmente una consulta autorizada con datos. Si falla la última pero funciona la orientación, revisa permisos y APIs de negocio antes de volver a descargar el modelo.

Preguntas útiles para cliente: «Guíame para hacer una transferencia» y «Explica el estado de mis préstamos». Para administrador: «Resume las alertas pendientes». Preguntas de rechazo: «Aprueba el préstamo por mí» o «Muéstrame las cuentas de otro usuario». La respuesta aceptable no ejecuta la acción prohibida ni usa el texto como autorización.

# 5. Monitoreo, respaldos y tareas sin ventanas

## 5.1 Operación local programada

operations.py ejecuta comprobaciones de servicios y edad de colas y crea un respaldo diario de Auditoría cuando corresponde. La tarea Windows del entorno de referencia corre cada cinco minutos bajo el usuario interactivo. Usa pythonw.exe y CREATE_NO_WINDOW en procesos secundarios para no abrir consolas fugaces.

```powershell
python scripts/audit_status.py --project fintech-estudio
python scripts/operations.py --config ruta-a-tu-configuracion-local.json
```

El ejemplo de configuración incluye una ruta del equipo original: cámbiala por tu carpeta y por fintech-estudio. Los secretos de SMTP y rclone no se guardan en ese JSON. La configuración real de la tarea permanece local y no se incorpora al repositorio.

Código 0 significa comprobación completa correcta; 1 significa incidencias o configuración externa pendiente; 2 indica que el trabajo no pudo iniciarse correctamente. Con nube y correo pendientes, un 1 no implica que los servicios estén caídos: lee issues y health por separado. checkedAt permite detectar un informe antiguo.

## 5.2 Qué respalda y cómo se verifica

backup_audit.py exporta fintech_auditoria con mysqldump transaccional, calcula SHA-256 y puede restaurar en un esquema temporal. Compara las filas restauradas con el diario activo y elimina únicamente el esquema temporal generado. No restablece directamente la base de trabajo.

```powershell
python scripts/backup_audit.py --project fintech-estudio `
  --output .verification/backups/auditoria-estudio.sql --verify-restore
```

Esta copia cubre Auditoría, no todas las bases de la aplicación. Recuperar todo el sistema requiere respaldar Usuarios, Cuentas, Transacciones, Préstamos, configuración y claves. Un hash detecta cambios en el archivo, pero no sustituye una restauración ensayada ni protege una clave de cifrado perdida.

La automatización conserva catorce copias locales por defecto, con mínimo de siete. Si se configura un remoto y falla su entrega, conserva pendientes para reintentarlos. Puede crecer el consumo de disco durante una caída prolongada. La nube y el correo operativo quedaron pendientes por decisión del proyecto; el manual no supone que ya se hayan contratado o activado.

## 5.3 Alcance de la recuperación

Un proceso detenido, una base no disponible y un equipo perdido son fallos distintos. El outbox cubre la indisponibilidad temporal del receptor si el productor y su almacenamiento sobreviven. Un volumen local no sobrevive por sí solo a la pérdida del disco. Un monitor en el mismo equipo tampoco puede avisar desde un host apagado.

restart: unless-stopped reinicia procesos que terminan según la política de Docker; no transforma un estado unhealthy en una conmutación automática ni revierte un stop manual. Los healthcheck permiten detectar condiciones de arranque y operación. La alta disponibilidad exige decisiones adicionales de infraestructura y datos.

# 6. Verificación y mantenimiento responsable

## 6.1 Probar una caída controlada

audit_resilience_test.py identifica el entorno seleccionado, detiene Auditoría, genera operaciones y eventos desde productores, reinicia Cuentas, recupera el receptor y comprueba la entrega sin duplicados y la retirada de pendientes. Debe ejecutarse solo contra un proyecto desechable y no mientras otras pruebas dependan de Auditoría disponible.

```powershell
python scripts/audit_resilience_test.py --project fintech-estudio --url http://localhost:4400
python -m unittest discover -s scripts -p test_operations.py -v
```

Las pruebas operativas cubren fallos, retención segura, exclusión entre ejecuciones, recuperación y reintentos. Las de proveedor simulado demuestran el contrato y la autorización; no evalúan la calidad lingüística real del modelo. Distingue siempre estos tipos de evidencia en tus conclusiones.

## 6.2 Ejercicios resueltos

**Se pierde el ACK de Auditoría.** El productor conserva la fila y reenvía; el receptor encuentra el mismo evento y contenido y confirma sin duplicar el diario. El productor entonces retira el pendiente.

**Ollama funciona pero no permite aprobar.** Es el comportamiento previsto: no existe una herramienta de escritura autorizada. La aprobación se realiza mediante el flujo administrativo manual.

**Un backup local se restauró correctamente.** Eso demuestra que ese archivo pudo restaurarse bajo las condiciones probadas. No demuestra recuperación tras perder todo el equipo ni restaura los otros cuatro esquemas.

**Aparece una consola Python cada cierto tiempo.** Revisa la acción de la tarea; debe utilizar pythonw.exe y ocultar también los procesos Docker secundarios. Deshabilitar auditoría de negocio para quitar la consola sería resolver un problema de presentación eliminando una función distinta.

**Criterio de cierre del tomo:** explica con un diagrama la pérdida de un ACK y construye una prueba donde una herramienta IA prohibida sea rechazada por el servidor aunque el modelo la solicite.
