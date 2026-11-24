# Transacciones: detalle, revisión y comprobantes

Actualizado el 14 de noviembre de 2026, America/Lima.

Desde **Transacciones → Ver detalle** se consultan importe, moneda, cuentas, referencia, concepto y estado. Si existe una reversión, ambas operaciones se enlazan. La vista mantiene el diseño azul y funciona en móvil.

## Revisión y confirmación

La revisión consulta al backend, valida propiedad de la cuenta origen, estado de ambas cuentas, moneda y saldo disponible. Devuelve únicamente la cuenta destino, sin exponer su propietario ni su saldo. Muestra el saldo de origen y una estimación posterior. No reserva fondos ni registra movimientos; la confirmación vuelve a validar y aplica el movimiento atómicamente en el servicio de cuentas.

Antes de enviar, se conserva la solicitud exacta y su clave de operación en `sessionStorage`, separadas por usuario. Una respuesta ambigua impide editar el movimiento e iniciar otro desde el mismo formulario. **Continuar después** permite cerrar el diálogo; **Retomar operación** recupera los datos después de recargar en la misma pestaña. El reintento utiliza siempre la misma clave. Un rechazo definitivo permite corregir y volver a revisar con otra clave. Un problema de acceso durante un reintento no descarta el resultado todavía incierto.

Este mecanismo de recuperación dura la sesión de la pestaña; no es una cola persistente entre dispositivos o navegadores. Si se cierra definitivamente esa sesión con un resultado desconocido, debe consultarse el historial antes de repetir una operación. Las operaciones `PROCESANDO` y los eventos del outbox requieren monitorización operativa.

## Estados y reversiones

- `COMPLETADA`: importe aplicado.
- `PENDIENTE` / `PROCESANDO`: resultado sin confirmar. La interfaz no promete que no hubo cambios de saldo.
- `FALLIDA`: rechazo definitivo sin aplicación del movimiento.
- `REVERTIDA`: original conservado y compensado mediante una reversión enlazada.
- `CANCELADA`: no se presenta como completada.

Solo el administrador puede revertir depósitos, retiros, transferencias y pagos ordinarios completados. Los movimientos propios de préstamos y las reversiones no admiten reversión independiente. El bloqueo del original y la clave compensatoria mantienen la idempotencia, incluso con solicitudes concurrentes. Reintentar la clave del movimiento original después de revertirlo conserva `REVERTIDA`; no vuelve a marcarlo completado.

## Comprobante PDF

Disponible para operaciones completadas y originales revertidos, con su estado actual y referencias vinculadas. Los movimientos pendientes, fallidos o cancelados responden 409. El origen, el destinatario de una transferencia y el administrador pueden descargarlo; terceros y usuarios anónimos no tienen acceso.

El PDF se genera en memoria con Apache PDFBox 3.0.8, responde como adjunto y utiliza `Cache-Control: no-store, private`. No se almacenan PDFs en disco en el servidor. Incluye estado consultado al emitir, fecha del registro, referencia y advertencia de demostración académica. No es un documento firmado ni una constancia bancaria oficial. Usa fuentes PDF estándar: los caracteres no representables, por ejemplo algunos emojis, se sustituyen por `?`; los acentos españoles se conservan. La [documentación oficial de PDFBox](https://pdfbox.apache.org/) describe la biblioteca utilizada.

## API

| Método y ruta | Resultado |
| --- | --- |
| `POST /api/transacciones/revisar` | Validación previa y estimación del saldo, sin movimientos |
| `GET /api/transacciones/{id}/detalle` | Movimiento, original y reversión vinculados |
| `GET /api/transacciones/{id}/comprobante` | PDF privado del movimiento autorizado |
| `POST /api/transacciones` | Confirmación con la cabecera obligatoria `Idempotency-Key` |
| `POST /api/transacciones/{id}/revertir` | Compensación administrativa idempotente |

No se requieren cambios en la base ni una nueva migración: se utilizan los movimientos y relaciones existentes. Una cabecera de operación ausente ahora devuelve 400 en lugar de un error interno.

## Verificación ejecutada

- Backend de transacciones: 19 pruebas aprobadas, con permisos, revisión de cuentas, estados, reintento de originales revertidos y PDF abierto, extraído y renderizado.
- Frontend: 36 pruebas aprobadas, incluyendo revisión previa, errores de destino, respuestas obsoletas, conservación de la clave y estados permitidos.
- Integración: 12 escenarios nuevos aprobados; también pasaron las 24 comprobaciones generales y los 11 escenarios de préstamos.
- Chrome en escritorio y móvil de 390 píxeles: revisión antes de enviar, pérdida intencional de la respuesta tras una transferencia completada, recuperación después de recargar con la misma clave, descarga real de PDF, navegación entre original y reversión y ausencia de comprobante para una operación fallida. Sin errores de JavaScript ni desbordamiento horizontal. Se inspeccionaron capturas y el PDF descargado renderizado.
- Mailpit estaba detenido al iniciar la regresión general. Se inició solo en el entorno aislado y se agregó `restart: unless-stopped` para que pueda volver a arrancar con Docker.

Entorno utilizado: proyecto Docker `fintech-verificacion`, frontend `http://localhost:4300`, volumen y puertos separados de los originales. Las pruebas crean usuarios y movimientos; ejecutarlas únicamente en entornos desechables:

```powershell
python scripts/transaction_smoke_test.py --url http://localhost:4300
python scripts/smoke_test.py --url http://localhost:4300 --mail http://localhost:8125
python scripts/loan_smoke_test.py --url http://localhost:4300
```

Quedan fuera de esta entrega la firma digital de comprobantes, la conciliación con proveedores bancarios reales, la recuperación entre dispositivos y las pruebas prolongadas de carga o caída de procesos. No se integraron agentes de IA en esta fase.
