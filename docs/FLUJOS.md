# Flujos de clientes y administradores

Revisión del 17 de noviembre de 2026. Entorno de demostración: `fintech-verificacion`, frontend `http://localhost:4300`. La nube y los correos operativos permanecen pendientes de configuración.

## Comportamiento revisado

| Recorrido | Comportamiento esperado y comprobado |
| --- | --- |
| Registro e inicio de sesión | Validación de datos, normalización del correo y bloqueo de envíos repetidos. Un fallo conserva los datos; una respuesta sin autenticación no abre el panel. Al abandonar el registro se cancela su redirección pendiente. |
| Resumen del cliente | Los saldos y contadores aparecen tras completar la consulta. Un error ofrece reintento y evita mostrar ceros como cifras verificadas. Se separan PEN y USD, se cuentan todas las cuentas y se deduplican los movimientos compartidos entre dos cuentas. Los saldos mostrados corresponden a cuentas activas. |
| Apertura de cuenta | El cliente revisa y confirma la apertura; la cuenta queda pendiente de activación. El administrador activa la cuenta mediante confirmación. Los reintentos conservan la clave de la apertura. |
| Movimientos | Revisión antes de confirmar, validación de titularidad, moneda y saldo, recuperación con la misma clave y comprobantes vinculados al movimiento. El historial distingue una consulta fallida de un resultado vacío. |
| Solicitudes de préstamo | Revisión y confirmación antes del envío. La evaluación interna es exclusiva del administrador; el cliente puede consultar su propio detalle. El ciclo HTTP comprueba aprobación, desembolso, pagos y reintentos. |
| Gestión de usuarios | Buscar por nombre, apellido, nombre completo, correo o DNI, conservando filtros de rol y estado. Cambiar el acceso exige confirmar la identidad y el efecto de la decisión. Desactivar conserva el historial y revoca sesiones; reactivar permite una sesión nueva sin rehabilitar tokens anteriores. |
| Cuentas de un usuario | Cambiar el usuario seleccionado cancela la consulta anterior. Un fallo no muestra datos de otra persona ni afirma que el usuario no tiene cuentas. |
| Decisiones sobre alertas | Diálogo con título y efecto específicos para resolver, descartar o bloquear. Motivo obligatorio de hasta 1000 caracteres, envío único mientras se procesa y conservación del motivo ante errores. El formulario usa el diálogo accesible de Material y se comprobó a 390 px. |
| Listas y filtros | Usuarios, Alertas, Cuentas, Movimientos y Préstamos cancelan consultas anteriores y muestran carga, error con reintento o resultado vacío de forma diferenciada. La espera se limita a 15 segundos. Las listas paginadas recuperan una página válida cuando desaparece el último registro de la página actual. |
| Permisos | Las rutas administrativas redirigen al cliente; las APIs también rechazan las peticiones administrativas de clientes. Ocultar acciones en la pantalla se complementa con la autorización del backend. |

## Comprobaciones reproducibles

Desde la raíz del repositorio, con el entorno de demostración arrancado:

```powershell
python scripts/smoke_test.py --url http://localhost:4300 --mail http://localhost:8125
python scripts/user_smoke_test.py --url http://localhost:4300
python scripts/account_smoke_test.py --url http://localhost:4300
python scripts/transaction_smoke_test.py --url http://localhost:4300
python scripts/loan_smoke_test.py --url http://localhost:4300
python scripts/notification_smoke_test.py --url http://localhost:4300
```

Estos scripts crean datos de demostración: deben apuntar a un entorno aislado. El conjunto suma 90 comprobaciones HTTP: 24 generales, 12 de usuarios, 12 de cuentas, 12 de transacciones, 18 de préstamos y 12 de notificaciones. La comprobación de Usuarios se añadió al flujo CI junto a la comprobación general; el frontend mantiene su ejecución completa de pruebas en CI.

Pasaron 115 pruebas Angular que comprueban las plantillas reales, fallos y recuperación, cancelación de consultas, límites de espera, protección frente a envíos duplicados y conservación de formularios. Las 40 comprobaciones Maven de Usuarios pasaron tras ampliar su consulta de búsqueda. La compilación de producción y el despliegue del frontend y Usuarios en el entorno aislado finalizaron correctamente.

## Recorrido en navegador

Chrome completó 21 comprobaciones con datos reales: registro, apertura y activación de cuenta, solicitud de préstamo, visibilidad de evaluación por rol, prohibición de rutas y API administrativas, error y reintento de una decisión sobre alertas, cancelación de un cambio de acceso, desactivación, revocación y reactivación, recuperación de cinco listas y del resumen y vistas móviles de ambos roles. No se observaron errores de JavaScript ni desbordamiento horizontal del documento a 390 px.

Evidencias locales: `.verification/flows-browser-result.json`, `flows-browser.log`, capturas `flows-*-mobile.png`, `flows-ui-tests.log`, `flows-users-tests.log`, `flows-users-integration.log` y `flows-{general,accounts,transactions,loans,notifications}.log`. Las capturas de Alertas y del panel del cliente también se inspeccionaron visualmente.

## Límites de esta revisión

Estos resultados corresponden al entorno local de demostración. Quedan por evaluar cargas prolongadas, catálogos grandes de clientes en los selectores, decisiones simultáneas de varios administradores y accesibilidad completa con lector de pantalla. La generación de IA tiene sus propias limitaciones y pruebas en [IA.md](IA.md) y [OLLAMA.md](OLLAMA.md). No se afirma que estas comprobaciones certifiquen una operación bancaria de producción.
