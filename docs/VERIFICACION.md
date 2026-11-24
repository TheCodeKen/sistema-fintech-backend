# Verificación de la entrega

Fecha: 13 de noviembre de 2026, America/Lima.

## Actualización de flujos — 17/11/2026

Se reforzaron registro, acceso, resúmenes por rol, consulta de cuentas, movimientos y préstamos, gestión de usuarios y decisiones sobre alertas. Pasaron 115 pruebas Angular, 40 pruebas Maven de Usuarios y 90 comprobaciones HTTP de integración. Chrome completó 21 comprobaciones de los recorridos con permisos, confirmaciones, recuperación de errores y vistas móviles de 390 px, sin errores de JavaScript ni desbordamiento horizontal del documento. La búsqueda por nombre completo y correo se verificó contra MySQL real y se añadió su script de integración a CI.

La compilación de producción y el despliegue de Usuarios y frontend en `fintech-verificacion` finalizaron correctamente; la comprobación final de salud encontró los servicios saludables. Alcance, evidencias y pendientes: [FLUJOS.md](FLUJOS.md). Los resultados anteriores permanecen debajo como historial de verificaciones.

## Resultados ejecutados

| Comprobación | Resultado |
| --- | --- |
| Maven verify, Java 17, cuatro servicios | 25 pruebas correctas; cuatro JAR generados |
| Angular 21.2.26, Material 21.2.14, TypeScript 5.9 | Compilación de producción correcta |
| Karma en ChromeHeadless | 25 pruebas correctas, incluidas plantillas, reglas de importes y revisión de movimientos |
| Construcción Docker desde fuente | Correcta para los cinco módulos |
| MySQL 8 y Flyway V1/V2 | Migraciones aplicadas y esquemas validados |
| Arranque Compose aislado | Cuatro APIs, frontend, MySQL y Mailpit operativos |
| Integración HTTP real | 24 comprobaciones correctas |
| npm audit --omit=dev | 0 alertas |
| npm audit completo | 21 alertas moderadas en herramientas de desarrollo; 0 altas/críticas |
| git diff --check | Sin errores de espacios |

Las 25 pruebas backend se distribuyen en usuarios (5), cuentas (8), transacciones
(4) y préstamos (8). No sustituyen las comprobaciones contra MySQL.

La auditoría npm completa conserva alertas transitivas en el CLI y las herramientas
de construcción (glob/minimatch, pacote y webpack-dev-server/sockjs/uuid). No se
incluyen en los archivos estáticos servidos por Nginx. No se aplicó `audit fix
--force` ni se forzaron versiones transitivas incompatibles para ocultarlas.

## Integración comprobada

`scripts/smoke_test.py` verifica:

- Autenticación obligatoria y separación ADMIN/CLIENTE.
- Privacidad de usuarios y cuentas; rechazo de recursos ajenos.
- Apertura y activación; clientes sin saldo inicial arbitrario.
- Rechazo de desembolsos directos y débitos de cuentas ajenas.
- Transferencia, reintento con la misma clave y rechazo de cambio de importe.
- Consulta del movimiento por el destinatario.
- Reversión idempotente y prohibición de revertir otra reversión.
- Transferencia rechazada sin cambios en ninguno de los saldos.
- Alertas por intentos fallidos y resolución mediante PATCH con CORS.
- Ocho retiros concurrentes con conservación del saldo exacto.
- Moneda del préstamo e inclusión de intereses en la deuda.
- Desembolso y pago sin duplicados al repetir la petición.
- Rechazo de eliminación de una cuenta con obligaciones.
- Entrega de eventos de auditoría desde el outbox persistente.
- Recuperación real mediante SMTP capturado por Mailpit.
- Token de recuperación de un solo uso y revocación de JWT anterior.
- Desactivación con efecto inmediato en otros servicios.

## Entorno utilizado y límites

Proyecto Docker `fintech-verificacion`, frontend 4300, APIs 8181–8184, MySQL 3407,
Mailpit 8125. Se utilizó un volumen independiente. No se actualizaron ni borraron
las bases o contenedores originales de los puertos 4200/8081–8084/3307.

El rediseño posterior se revisó mediante Chrome automatizado y capturas de
1440 y 390 píxeles. No hubo errores de ejecución ni desbordamiento horizontal en
el dashboard móvil. Se comprobó que un movimiento no se envía antes de confirmarlo.
No se conectaron proveedores de pagos ni servidores
de correo externos, ni se ejecutó una auditoría de CVE de dependencias Maven. La
actualización sobre una copia de una base histórica poblada y las pruebas de carga
prolongadas requieren una verificación separada antes de un despliegue real.

Las pruebas de idempotencia y concurrencia no equivalen a una simulación completa
de todas las particiones de red o caídas de procesos. Los resultados ambiguos
conservan la misma clave para reintento; debe monitorizarse `PROCESANDO` y el outbox.
# Verificación adicional del ciclo de préstamos

19 pruebas de préstamos, 29 del frontend y 11 escenarios nuevos de integración aprobados. Las 24 comprobaciones generales también pasaron. Se verificó el vencimiento mediante el proceso programado en la base aislada y la regularización mediante un pago desde Chrome. La navegación, el historial y la cancelación se comprobaron en escritorio y móvil de 390 píxeles, sin errores de JavaScript ni desbordamiento horizontal. Véase [PRESTAMOS.md](PRESTAMOS.md).

## Verificación adicional de transacciones — 14/11/2026

19 pruebas de backend de transacciones y 36 del frontend aprobadas. Se verificaron 12 escenarios nuevos de integración, además de repetir con éxito los 24 generales y los 11 de préstamos. Chrome confirmó la recuperación tras perder una respuesta de éxito, el uso de la misma clave después de recargar, la descarga de PDF y la navegación entre original y reversión. El PDF descargado se abrió y renderizó; escritorio y móvil sin errores de JavaScript ni desbordamiento horizontal. Reglas y límites en [TRANSACCIONES.md](TRANSACCIONES.md).
## Notificaciones personales — 14/11/2026

58 pruebas de backend en los tres servicios modificados (usuarios 14, transacciones 23, préstamos 21), 42 de frontend y 14 escenarios nuevos de integración aprobados. También se repitieron los 24 escenarios generales, 12 de transacciones y 11 de préstamos. Se verificaron entrega tras error 503, reentrega de un aviso leído sin sobrescribirlo, permisos por destinatario, vencimientos desde el proceso programado y lectura masiva que conserva avisos recién llegados. Chrome: campana, filtros, lectura, navegación y cambio de sesión; escritorio, tablet y móvil sin errores de JavaScript ni desbordamiento horizontal. Reglas, migraciones y límites en [NOTIFICACIONES.md](NOTIFICACIONES.md).

## Asistentes de IA — 14/11/2026

Integración con OpenAI implementada para cliente y administrador. Pasaron 29 pruebas del backend de usuarios, 49 de frontend, 17 escenarios integrales con proveedor simulado y tres comprobaciones finales sin clave. Chrome verificó ambos modos, consulta opcional de datos, fuentes, aislamiento de sesión y móvil; sin errores de JavaScript ni desbordamiento horizontal. También pasaron los 24 escenarios generales, 12 de transacciones y 11 de préstamos. No se hizo una llamada a un modelo real: falta configurar la clave y verificar sus respuestas. El proveedor ficticio se retiró; el estado final muestra disponibilidad pendiente de activación. Véase [IA.md](IA.md).
## Diagnóstico de OpenAI con clave real — 14/11/2026

La configuración cargó correctamente la clave, el endpoint oficial y el modelo. El acceso al modelo respondió 200; una petición mínima de generación sin información financiera respondió 429 con `credit_balance_exhausted` / `insufficient_quota`. No se obtuvo una respuesta generada por el modelo real. Se mejoró el backend para distinguir saldo agotado, límite temporal y credencial rechazada sin filtrar mensajes privados. Las 33 pruebas del backend de usuarios pasaron. Falta agregar crédito disponible y validar la generación real.

## Ollama local y traslado de Docker — 14/11/2026

El proveedor activo pasó a Ollama 0.40.16 con `qwen3:4b-instruct-2507-q4_K_M`. Se verificaron respuestas reales de ambos asistentes, sin proveedor simulado: nueve comprobaciones de integración aprobadas para disponibilidad, autenticación, permisos de administrador, guía de transferencias, cuentas propias, alertas, solicitudes, saldos intactos y enlaces internos. Las cuatro consultas del último recorrido tardaron 3,1; 1,0; 5,1 y 3,6 segundos. `ollama ps` confirmó el modelo en GPU al 100 %, contexto 16384 y unos 4 GB de memoria. Se comprobó que la clave de OpenAI está vacía en el contenedor y `OLLAMA_NO_CLOUD=1` está activo.

Pasaron las 40 pruebas del backend de usuarios y las 50 de frontend; compilación Angular e imagen Docker correctas. Tras el traslado y cambio de proveedor se repitieron con éxito 24 escenarios generales, 12 de transacciones, 11 de préstamos y 12 de notificaciones. No se repitió la modificación de fechas para vencimientos de notificaciones, verificada en la etapa anterior.

Chrome comprobó con inferencia real la guía, cuentas propias, alertas administrativas, consentimiento desactivado inicialmente, borrado de conversación al cambiar permisos, aislamiento entre sesiones y cierre por Escape. Escritorio de 1440 px y móvil de 390 px sin errores de JavaScript ni desbordamiento horizontal; capturas revisadas visualmente.

C: se llenó durante la instalación. Con autorización explícita del usuario se detuvo Docker y se trasladó su disco virtual completo a `D:\DockerData\disk`, comprobando igualdad SHA-256 antes de retirar el archivo original y manteniendo una unión desde la ruta previa. Docker reinició y recuperó tanto los contenedores originales como los del proyecto aislado; no se sustituyeron volúmenes ni bases. El almacenamiento de este equipo y las precauciones para conservarlo están documentados en [OLLAMA.md](OLLAMA.md).

Límites pendientes: carga prolongada, funcionamiento en CPU, comportamiento en arranque en frío y evaluación sistemática de calidad e inyección de instrucciones contra el modelo real. Se observaron resúmenes que confundían el total de alertas con la muestra y deducciones sin respaldo; se reforzaron las instrucciones, pero no se garantiza la exactitud de texto generado. Las herramientas y permisos siguen siendo de solo consulta; las fuentes y detalles del sistema deben usarse para verificar cifras y estados antes de decidir. La generación opcional de OpenAI con saldo sigue sin verificar y no es necesaria para el funcionamiento local.

## Gestión de cuentas — 17/11/2026

La apertura incluye revisión de titular, tipo, moneda y saldo inicial. La confirmación envía `Idempotency-Key` y conserva la solicitud por usuario en `sessionStorage` hasta conocer el resultado. Puede recuperarse al recargar la misma pestaña. La migración Flyway V3 de cuentas crea `aperturas_cuenta` y se aplicó correctamente en el entorno `fintech-verificacion`. Repetir clave y datos devuelve la cuenta existente con su estado actual. Cambiar datos de una clave registrada devuelve 409. Los clientes sin cabecera conservan el contrato anterior y deben gestionar sus reintentos.

Activación, bloqueo, congelación, desbloqueo y cierre se confirman mostrando la cuenta afectada. Durante la petición se bloquean envíos repetidos. Los errores permanecen en el diálogo y conservan el motivo. Se exige un motivo de 5 a 500 caracteres. Repetir un estado ya aplicado devuelve el resultado sin generar otra auditoría. El cierre sigue exigiendo saldo cero y ausencia de obligaciones, conserva el historial y tiene una única acción en el menú.

Pasaron 10 pruebas del backend de cuentas y 69 del frontend, además de 12 escenarios de cuentas, 24 generales, 12 de transacciones y 18 de préstamos. MySQL verificó seis aperturas concurrentes con una sola creación, permisos, recuperación del estado actual, rollback y conservación del historial. Chrome confirmó la recuperación tras perder una respuesta y recargar, ambos roles, errores de saldo, validación y conservación del motivo, y todas las transiciones del menú. Se revisaron capturas de escritorio y móvil de 390 px, sin errores de JavaScript ni desbordamiento horizontal en los diálogos.
# Auditoría independiente — 17/11/2026

Actualización operativa: se registró y ejecutó la tarea Windows `FinTech-Operations-fintech-verificacion`, con intervalo de cinco minutos y respaldo cada 24 horas. Pasaron 13 pruebas de automatización. Una caída controlada real de Auditoría fue detectada y la recuperación volvió a mostrar saludables los servicios. El respaldo automatizado final restauró 845 registros con cero diferencias. Los informes activos están en `.verification/operations/`. La tarea devuelve 1 por `offsite_not_configured` y `notifications_not_configured`: los destinos de nube y SMTP siguen pendientes; las pruebas de esas integraciones son simuladas. Ver [OPERACIONES.md](OPERACIONES.md).

Se desplegó `ms-auditoria` en el proyecto aislado `fintech-verificacion`, con esquema propio y recepción idempotente. Usuarios, Cuentas, Transacciones y Préstamos conservan los eventos en sus bases hasta recibir confirmación. El diario anterior permanece conservado: la migración verificó sus 733 registros sin diferencias.

Pasaron 101 pruebas de backend (Auditoría 6, Usuarios 40, Cuentas 10, Transacciones 23 y Préstamos 22), 77 de frontend y 78 comprobaciones de integración: generales 24, transacciones 12, préstamos 18, cuentas 12 y notificaciones 12. La comprobación general ahora filtra por su usuario y acción para evitar que otros escenarios concurrentes desplacen el evento fuera de la primera página.

La prueba de resiliencia pasó 12 comprobaciones: detuvo Auditoría, realizó y reintentó una transferencia sin duplicar saldos, generó eventos desde los cuatro productores y reinició Cuentas. Al recuperar Auditoría se entregaron los nueve eventos pendientes exactamente una vez y se vaciaron las colas. También se verificaron permisos, clave interna, conflictos de contenido e ingreso concurrente del mismo evento.

Chrome comprobó filtros, detalle, mensaje de indisponibilidad y reintento, sin errores de JavaScript ni desbordamiento horizontal a 390 px. El respaldo final se restauró en un esquema temporal: 823 registros, cero diferencias; el esquema temporal fue retirado. La comprobación final de salud encontró los seis servicios de datos/backend saludables y las cuatro colas vacías.

Evidencias locales en `.verification/audit-resilience-final.log`, `audit-browser.log`, `audit-migration-final.json`, `final-*.log` y `backups/auditoria-final-20261117.sql.json`. Los respaldos contienen datos del entorno de demostración y deben mantenerse fuera del repositorio.

Límites: MySQL, el equipo Docker y la validación de sesiones mediante Usuarios siguen compartidos. El respaldo verificado es local. Quedan pendientes recuperación ante pérdida del host, respaldo externo programado, avisos operativos automáticos y pruebas prolongadas de carga. Alertas permanece en Transacciones en esta fase. Procedimientos: [AUDITORIA.md](AUDITORIA.md).

