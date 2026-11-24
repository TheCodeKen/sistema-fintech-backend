# Ciclo de préstamos

El detalle se abre desde **Préstamos → Ver detalle**. Muestra el cronograma, los pagos y los datos de la solicitud. Los importes de distintas monedas se presentan por separado.

## Solicitud y confirmación

El formulario valida importe desde 500 con hasta dos decimales, tasa anual de 1 a 100 % con hasta dos decimales y plazo entero de 3 a 360 meses. Para clientes se aplica la tasa vigente de 18 %. La cuenta debe estar activa y pertenecer al titular seleccionado. Su moneda determina la solicitud. Actualizar cuentas conserva los importes escritos y cancela consultas anteriores al cambiar de cliente.

Antes de confirmar se revisan cuenta, importe, tasa, plazo, cuota, intereses y total estimados. El total usa la cuota mensual redondeada a centavos multiplicada por el plazo. Los importes definitivos se consultan en el préstamo registrado. Se rechazan totales que excedan la capacidad del modelo de datos.

La confirmación guarda los datos y una clave por usuario en `sessionStorage`. Tras una respuesta incierta, **Continuar después** y **Retomar solicitud** permiten recuperar la misma solicitud en esa pestaña, incluso tras recargar. Durante esa recuperación los datos se conservan hasta confirmar el resultado. La recuperación entre dispositivos requiere otro mecanismo.

`POST /api/prestamos` admite `Idempotency-Key` de 8 a 64 caracteres alfanuméricos, guiones y guiones bajos. Flyway V5 agrega `solicitudes_prestamo`. La clave se separa por usuario ejecutor y la creación comparte una transacción y un bloqueo de base de datos con su registro. Repetir clave y datos devuelve el mismo préstamo con su estado actual. Cambiar las condiciones de una clave registrada responde 409. Los clientes que omiten la cabecera conservan el contrato previo y deben controlar sus propios reintentos.

## Evaluación con historial interno

El administrador abre **Préstamos → Evaluar solicitud** y consulta el historial del titular antes de decidir. La ficha separa deuda y cuotas mensuales por moneda, muestra vencimientos pendientes calculados a la fecha de corte, cuenta otros préstamos por estado y ofrece el historial paginado y los diez pagos más recientes con enlaces a sus registros. La solicitud actual se excluye de los antecedentes. Los registros sin cronograma completo se advierten expresamente. La consulta no reconstruye cuotas ni modifica préstamos.

Un cliente nuevo aparece como «Sin historial registrado en la aplicación». La ficha contiene únicamente información de este sistema y no incluye un reporte de una central de riesgo ni una calificación automática. La capacidad de pago y la documentación requieren evaluación del administrador.

Desde la ficha se inicia la revisión. Para confirmar una aprobación o un rechazo, la interfaz exige marcar la revisión del historial, elegir la decisión y escribir una observación de 5 a 500 caracteres. La observación o el motivo se conserva en el préstamo y se registra la acción en la auditoría. La aprobación mantiene el desembolso como paso posterior. Un fallo conserva el texto y solicita actualizar la ficha para comprobar el estado antes de volver a confirmar. Los accesos directos para aprobar o rechazar desde la tabla se sustituyeron por esta entrada de evaluación.

`GET /api/prestamos/{id}/evaluacion?pagina=0` está restringido a administradores y responde con `Cache-Control: no-store`. Los totales incluyen todos los otros préstamos del cliente y el historial se pagina en grupos de veinte. Los endpoints existentes de aprobación y rechazo conservan sus permisos y contratos. No se requieren migraciones para esta ficha.

## Reglas

- El cronograma nace con el desembolso confirmado. La primera cuota vence un mes después; las siguientes conservan el día de origen con ajuste al último día del mes. El vencimiento final se calcula desde ese desembolso.
- Se conserva el total pactado del préstamo, incluidos los intereses calculados por el modelo existente. El último importe absorbe los centavos del redondeo. No hay recargos por mora ni descuentos por pago anticipado en este modelo académico.
- Los pagos parciales cubren primero las cuotas más antiguas. El cronograma y el saldo se concilian antes de debitar. El historial incluye cuenta, fecha, importe, transacción y clave de operación.
- Los reintentos conservan la misma operación. La interfaz guarda una operación pendiente en la sesión del navegador ante una respuesta ambigua y reconoce los pagos ya confirmados en el historial al recargar.
- Se considera vencida una cuota con saldo cuya fecha sea anterior al día actual en `America/Lima`. Durante el propio día del vencimiento todavía está vigente. Un proceso revisa los préstamos activos cada 60 segundos; abrir el detalle también actualiza su estado. Cubrir todas las cuotas vencidas regulariza el préstamo; cubrir todo el saldo lo marca pagado.
- El cliente puede cancelar solicitudes pendientes o en revisión. El administrador también puede cancelar las aprobadas antes del desembolso. Se exige un motivo de 5 a 500 caracteres. Se conserva el registro y la auditoría, sin mover fondos. Las operaciones comparten el bloqueo de la fila del préstamo.
- El backend valida propiedad o rol administrativo antes de consultar detalles o cancelar. La interfaz no es la barrera de autorización.

## API y persistencia

`GET /api/prestamos/{id}/detalle` devuelve solicitud, cuotas, historial y resumen. `POST /api/prestamos/{id}/cancelar` recibe `{"motivo":"Cambio de planes"}`. Los endpoints de desembolso y pago mantienen su contrato.

Flyway V3 agrega `cuotas_prestamo`, metadatos de pagos y fechas/motivo de cancelación. Las migraciones anteriores no se alteran. Los registros históricos reconocibles se vinculan al préstamo usando su clave y huella originales; no se inventan fechas de pago ni referencias a transacciones. Para préstamos históricos, el cronograma se reconstruye desde el vencimiento registrado y se informa esta limitación. Si no es posible reconstruirlo o conciliarlo, no se permiten nuevos débitos hasta corregir los datos. Antes de producción debe ensayarse la migración sobre una copia de la base real con respaldo.

## Verificación

La ficha de evaluación interna se verificó el 17/11/2026 con 22 pruebas del backend y 75 del frontend aprobadas. Ocho escenarios nuevos comprobaron permisos, exclusión de la solicitud actual, paginación de antecedentes, referencias de pagos, separación PEN/USD, vencimientos reales, cronogramas incompletos y cliente nuevo. Se repitieron los 18 escenarios de préstamos, 24 generales, 12 de transacciones y 12 de cuentas.

Chrome confirmó navegación entre préstamos relacionados, consulta de pagos, revisión manual, observación conservada tras error, actualización del estado antes de reintentar y aprobación/rechazo registrados. Se verificaron ambas monedas, cliente sin antecedentes, permisos de cliente y escritorio/móvil de 390 px sin errores de ejecución ni desbordamiento horizontal. La simulación de cronograma incompleto afectó exclusivamente a un préstamo nuevo de demostración y restauró la cuota retirada tras comprobar que la ficha no la reconstruyera.

El 17/11/2026 pasaron 22 pruebas del backend de préstamos, 63 del frontend y 18 escenarios del ciclo de préstamos. Se repitieron los 24 escenarios generales y los 12 de transacciones. MySQL verificó seis confirmaciones concurrentes con una sola creación, rechazo de cambios de condiciones, recuperación del estado actual, propiedad, compatibilidad sin cabecera y rollback tras un rechazo. Flyway V5 se aplicó correctamente en `fintech-verificacion`.

Chrome verificó ambos roles, cuentas activas, moneda derivada, decimales, plazo entero, límites de tasa, revisión previa y recuperación con la misma clave después de perder una respuesta y recargar. En el caso probado, cuota de 171.69, intereses de 15.07 y total de 515.07 coincidieron con el préstamo registrado de 500 a tres meses y 18 % anual. Se revisaron capturas de escritorio y móvil de 390 px, con los formularios completos accesibles por desplazamiento, sin errores de JavaScript ni desbordamiento horizontal.

Backend de préstamos: 19 pruebas aprobadas, incluyendo redondeo, fin de mes, vencimiento con reloj fijo, pagos parciales, conciliación y permisos de cancelación. Frontend: 29 pruebas aprobadas, incluyendo recuperación de operaciones ambiguas e importes superiores al saldo.

El entorno Docker aislado `fintech-verificacion` usa la interfaz en `http://localhost:4300`. Se verificaron 11 escenarios de integración nuevos con `python scripts/loan_smoke_test.py --url http://localhost:4300`, además de los 24 escenarios generales de `scripts/smoke_test.py`. Ambos scripts crean datos y movimientos: deben ejecutarse exclusivamente contra entornos desechables.
