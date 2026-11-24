# FASE 11 - Matriz de pruebas E2E e integración

## Preparación

- [ ] Inicializar MySQL con `init-db.sql`; Flyway crea y versiona las tablas al arrancar los servicios.
- [ ] Confirmar que existen los cuatro schemas y las tablas `usuarios`,
      `cuentas`, `transacciones`, `alertas`, `prestamos` y `auditoria`.
- [ ] Definir `JWT_SECRET`, `INTERNAL_SERVICE_KEY` y los cuatro umbrales
      antifraude.
- [ ] Compilar los cuatro microservicios y el frontend.
- [ ] Confirmar disponibilidad de `8081`, `8082`, `8083`, `8084` y `4200`.
- [ ] Iniciar sesión con `admin@fintech.pe / admin123`.

## Criterio de evidencia

Cada caso debe conservar: request sin secretos, código HTTP, respuesta
relevante, IDs generados, saldos antes/después y una captura o consulta SQL
que demuestre el resultado. No guardar JWT ni contraseñas en evidencias.

## Casos críticos

### Test 1 - JWT, autenticación y autorización

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1.1 | `GET /api/cuentas` sin `Authorization` | `401` JSON uniforme |
| 1.2 | Usar un JWT inválido o expirado | `401` y no se ejecuta la operación |
| 1.3 | Usar JWT de CLIENTE en `GET /api/usuarios` | `403` JSON uniforme |
| 1.4 | Usar JWT ADMIN en `GET /api/auditoria` | `200` paginado |
| 1.5 | Usar JWT ADMIN en `GET /api/alertas` | `200` paginado |

### Test 2 - Apertura de cuenta

1. Crear una cuenta para el usuario cliente `id=2` con `POST /api/cuentas`.
2. No enviar `numeroCuenta`; enviar `tipoCuenta`, `moneda` y `saldoInicial=0` como CLIENTE.
3. Verificar `201`, `usuarioId=2` y formato `^FT[0-9]{8}$`.
4. Confirmar unicidad, saldo cero para clientes y estado pendiente de verificación; activar como ADMIN.
5. Repetir con un `usuarioId` inexistente: esperar error controlado `4xx`.

### Test 3 - Transferencia, saldo y antifraude

1. Consultar saldos de las cuentas generadas por el entorno de prueba.
2. Abrir/activar dos cuentas, financiar una con un depósito de demostración y ejecutar una transferencia con números reales e `Idempotency-Key`: esperar `201`, estado
   `COMPLETADA` y saldo origen reducido/destino aumentado.
3. Ejecutar una transferencia superior al saldo: esperar `400` o `409`,
   sin cambios de saldo y transacción `FALLIDA` si fue persistida.
4. Ejecutar una transferencia superior a `ANTIFRAUDE_UMBRAL_PEN`: verificar
   alerta `MONTO_ELEVADO`, riesgo `ALTO`, cuenta y `transaccionId`.
5. Ejecutar cuatro transferencias al mismo destino en menos de cinco minutos:
   verificar alerta `TRANSACCION_REPETITIVA`, riesgo `MEDIO`.
6. Intentar movimientos fallidos repetidos: verificar alerta
   `INTENTOS_FALLIDOS`, riesgo `CRITICO`.

### Test 4 - Reversión administrativa

1. Crear o seleccionar una transacción `COMPLETADA`.
2. Con CLIENTE, llamar `POST /api/transacciones/{id}/revertir`: esperar `403`.
3. Con ADMIN, repetir: esperar `201`.
4. Verificar que la transacción original conserve su ID y pase a `REVERTIDA`.
5. Verificar una nueva transacción `REVERSION` con
   `transaccionPadreId={id_original}`.
6. Confirmar saldos compensados y que un segundo intento sea rechazado.

### Test 5 - Workflow de préstamo

1. CLIENTE crea una solicitud: `PENDIENTE`.
2. ADMIN llama `PATCH /api/prestamos/{id}/revisar`: `EN_REVISION`.
3. ADMIN llama `PATCH /api/prestamos/{id}/aprobar`: `APROBADO`.
4. ADMIN desembolsa: `POST /api/prestamos/{id}/desembolsar`.
5. Verificar saldo acreditado, transacción `DESEMBOLSO_PRESTAMO` y estado
   `DESEMBOLSADO`.
6. CLIENTE paga una cuota con `POST /api/prestamos/{id}/pagar`.
7. Verificar débito, transacción `PAGO_PRESTAMO`, reducción de
   `saldoPendiente` y `PAGADO` cuando llegue a cero.
8. Rechazar una solicitud sin motivo o desembolsar una no aprobada: esperar
   `4xx` y ningún movimiento contable.

### Test 6 - Auditoría y trazabilidad

1. Bloquear o congelar una cuenta como ADMIN.
2. Aprobar, rechazar o desembolsar un préstamo.
3. Revertir una transacción.
4. Cambiar el estado de un usuario.
5. Consultar `GET /api/auditoria` con filtros por acción, entidad y fechas.
6. Verificar ejecutor, rol, entidad, ID, detalle, fecha e IP.
7. Confirmar que no se registra auditoría falsa cuando la operación falla
   antes de persistir el cambio.

## Regresión y cierre

- [ ] CLIENTE no puede acceder a módulos exclusivos ADMIN.
- [ ] No existen botones de editar/eliminar para transacciones completadas.
- [ ] Los saldos no se modifican mediante formularios públicos.
- [ ] Las alertas se muestran en `/alertas`, con filtros y paginación.
- [ ] El contador del navbar coincide con `GET /api/alertas/pendientes/count`.
- [ ] `npm run build` termina correctamente.
- [ ] No hay errores 5xx en logs durante la matriz.
- [ ] Se documentan como bloqueadores todos los casos fallidos.

## Consultas SQL de apoyo

```sql
SELECT id, email, dni, rol, activo FROM fintech_usuarios.usuarios;
SELECT id, numero_cuenta, usuario_id, saldo, moneda, estado
FROM fintech_cuentas.cuentas;
SELECT id, tipo_transaccion, estado, transaccion_padre_id, numero_referencia
FROM fintech_transacciones.transacciones
ORDER BY id DESC;
SELECT id, tipo_alerta, nivel_riesgo, estado, numero_cuenta, transaccion_id
FROM fintech_transacciones.alertas
ORDER BY id DESC;
SELECT accion, entidad_afectada, entidad_id, fecha_registro
FROM fintech_usuarios.auditoria
ORDER BY id DESC;
```
