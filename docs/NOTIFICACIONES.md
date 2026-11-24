# Notificaciones personales

La campana muestra los avisos sin leer y abre **Notificaciones**. El buzón permite consultar todas o solo las no leídas, paginar, marcar una, marcar todas las consultadas hasta ese momento y abrir la operación relacionada. Conserva el diseño azul y minimalista. El contador se consulta cada 15 segundos mientras la navegación está activa; el listado se actualiza al entrar, filtrar, marcar o pulsar **Actualizar**.

## Eventos cubiertos

- Depósitos, retiros y pagos ordinarios confirmados.
- Transferencias: aviso para emisor y destinatario. Entre cuentas del mismo usuario se genera un solo aviso.
- Reversiones confirmadas para los propietarios implicados, con enlace al movimiento compensatorio.
- Solicitudes de préstamo recibidas, en revisión, aprobadas, rechazadas, canceladas y desembolsadas.
- Pagos de préstamos y liquidación completa. Se evita emitir además otro aviso genérico desde transacciones para esos mismos movimientos internos.
- Cuotas pendientes que vencen dentro de los próximos tres días, incluido el día actual, y cuotas ya vencidas. Cada cuota genera como máximo un aviso próximo y uno vencido; no se repiten cada día. Las cuotas pagadas no generan avisos de vencimiento.

Los vencimientos se revisan cada 60 segundos mediante el proceso existente de préstamos, usando `America/Lima`. Abrir el detalle también puede detectar y preparar esos avisos. Los mensajes reflejan el evento ocurrido: para conocer el saldo y estado actuales debe abrirse el detalle. Los movimientos históricos no se notifican retroactivamente; sí se revisan las cuotas pendientes de préstamos activos.

## Privacidad y lectura

El destinatario del buzón se obtiene de la sesión validada por el backend, sin aceptar un usuario elegido por el cliente. Un administrador consulta únicamente su propio buzón. Marcar un identificador ajeno responde 404 y no cambia su lectura. Los enlaces se generan desde el tipo y el identificador del recurso; la interfaz restringe la navegación a detalles internos de préstamos y transacciones, que vuelven a comprobar los permisos.

La lectura individual es idempotente: conserva la primera fecha de lectura. La lectura masiva utiliza un límite de identificador obtenido al cargar la primera página del listado; los avisos que llegan después no quedan leídos por accidente. Los filtros y el contador solo consideran al usuario autenticado. Al cerrar sesión se reinicia el contador.

## Entrega persistente e idempotencia

Los productores guardan los avisos en `avisos_pendientes` dentro de la misma transacción que confirma el estado del negocio. No necesitan contactar con usuarios para enviar el aviso durante la confirmación financiera. Un proceso independiente entrega hasta 50 avisos cada cinco segundos y reintenta los pendientes si el receptor falla. No guarda ni transmite JWT de clientes; utiliza la credencial interna del servicio.

La clave única del aviso identifica movimiento y destinatario, cambio de estado, pago o cuota. Los productores conservan la clave y la fecha de entrega, incluso después del envío, para no regenerar eventos periódicos. El receptor también tiene una clave única y una inserción idempotente: una reentrega no duplica el aviso ni sobrescribe su texto o su fecha de lectura. Si un usuario fue eliminado físicamente antes de la entrega, el receptor descarta ese aviso sin bloquear la cola.

Las transacciones nuevas conservan los identificadores de los propietarios de origen y destino. Para operaciones antiguas que todavía requieren ejecución o reversión, se resuelven antes de llamar al servicio de movimientos. No se exponen esos identificadores adicionales en la respuesta pública del movimiento.

La cola conserva las claves entregadas; no hay purga automática en esta fase. Una futura política de retención debe preservar la deduplicación. Un error persistente de entrega requiere revisar el registro del productor y la disponibilidad del receptor.

## API

| Método y ruta | Uso |
| --- | --- |
| `GET /api/usuarios/notificaciones?page=0&size=10&noLeidas=false` | Buzón personal, ordenado por llegada; tamaño máximo 50 |
| `GET /api/usuarios/notificaciones/resumen` | Contador personal de no leídas |
| `PATCH /api/usuarios/notificaciones/{id}/leer` | Marcar una propia; respuesta 204 |
| `PATCH /api/usuarios/notificaciones/leer-todas` | JSON `{"hastaId":123}`; respuesta 204 |
| `POST /api/usuarios/notificaciones/internal/eventos` | Recepción entre servicios; requiere la credencial interna y datos válidos |

La ruta interna acepta llamadas sin JWT porque los productores trabajan en segundo plano; verifica obligatoriamente `X-Internal-Service` y deniega claves incorrectas o vacías. No debe exponerse la credencial al frontend.

## Migraciones y despliegue

- Usuarios V3: buzón, lectura, índices y clave única de recepción.
- Transacciones V3: destinatarios del movimiento y cola persistente.
- Préstamos V4: cola persistente.

Las migraciones anteriores permanecen sin cambios. Actualizar primero usuarios y después los productores evita reintentos iniciales por un receptor antiguo. Un productor con avisos pendientes los entregará al recuperarse el receptor. Respaldar la base y ensayar las migraciones sobre una copia antes de un despliegue real.

## Verificación

El entorno de comprobación es exclusivamente el proyecto Docker `fintech-verificacion`, con frontend en `http://localhost:4300` y volumen independiente. No se reemplazaron los contenedores originales.

Los servicios modificados aprobaron 14 pruebas de usuarios, 23 de transacciones y 21 de préstamos. Incluyen privacidad, límites de página y lectura, avisos para emisor/destinatario, transferencia entre cuentas propias, ausencia de confirmación ante resultado financiero incierto y recuperación de entrega después de una respuesta 503. El frontend aprobó 42 pruebas, incluyendo navegación, lectura, filtro y límite de lectura masiva.

La integración de notificaciones aprobó 14 escenarios: autenticación, intento de falsificación, permisos incluso para administradores, conservación de lectura, reentrega idempotente, reversión concurrente, ciclo del préstamo, avisos programados y lectura masiva con una llegada posterior. También se repitieron las 24 comprobaciones generales, 12 de transacciones y 11 de préstamos.

Chrome verificó contador, filtros, lectura individual y masiva, apertura del detalle y aislamiento al cambiar de sesión. Se inspeccionaron capturas de escritorio, tablet de 1024 píxeles y móvil de 390 píxeles, sin errores de JavaScript ni desbordamiento horizontal.

```powershell
python scripts/notification_smoke_test.py --url http://localhost:4300
```

Para comprobar además la reentrega desde un productor y el proceso real de vencimientos, usar `--test-due-dates`. Esta opción está restringida al entorno local 4300 y al proyecto `fintech-verificacion`: modifica exclusivamente las fechas del préstamo recién creado por la prueba y espera el proceso programado. Los scripts crean usuarios y fondos de demostración; nunca ejecutarlos contra producción.

No se incluyen correo o push para estos avisos, WebSockets, resúmenes de IA, preferencias de canal, purga automática ni pruebas prolongadas de carga o caída de procesos. Los correos existentes de recuperación de contraseña siguen usando su flujo SMTP separado.
