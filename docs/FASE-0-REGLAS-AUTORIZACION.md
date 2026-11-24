# FinTechPro — Fase 0: reglas de negocio y autorización

Este documento define el contrato inicial de autorización para `ADMIN` y
`CLIENTE`. La autorización efectiva debe aplicarse en los microservicios; los
guards de Angular solo controlan la navegación de la interfaz.

## Matriz de permisos

| Microservicio | Operación | ADMIN | CLIENTE |
|---|---|---:|---:|
| `ms-usuarios` | Login, registro y recuperación de contraseña | Sí | Sí |
| `ms-usuarios` | Listar, crear, actualizar y eliminar usuarios | Sí | No |
| `ms-usuarios` | Consultar un usuario por ID | Sí | Sí, sujeto a la política de privacidad |
| `ms-cuentas` | Listar todas las cuentas | Sí | No |
| `ms-cuentas` | Consultar una cuenta propia por ID, número o usuario | Sí | Sí, solo recursos propios |
| `ms-cuentas` | Aperturar una cuenta | Sí, para un cliente activo | Sí, para sí mismo |
| `ms-cuentas` | Actualizar datos administrativos de una cuenta | Sí | No |
| `ms-cuentas` | Bloquear, desbloquear, congelar, reactivar o cerrar | Sí | No |
| `ms-cuentas` | Ajustar saldo | Solo operación administrativa autorizada | No |
| `ms-transacciones` | Listar todas las transacciones | Sí | No |
| `ms-transacciones` | Consultar transacciones propias | Sí | Sí |
| `ms-transacciones` | Crear depósito, retiro, pago o transferencia | Sí | Sí, sobre cuentas propias |
| `ms-transacciones` | Editar o eliminar una transacción | No como operación física | No |
| `ms-transacciones` | Cancelar o revertir | Sí, con motivo y auditoría | Según política futura |
| `ms-prestamos` | Listar todos los préstamos | Sí | No |
| `ms-prestamos` | Consultar préstamos propios | Sí | Sí |
| `ms-prestamos` | Solicitar préstamo | Sí, como operación administrativa | Sí |
| `ms-prestamos` | Aprobar, rechazar o desembolsar | Sí | No |
| `ms-prestamos` | Editar o eliminar préstamos con historial financiero | No | No |

Las operaciones entre microservicios deben propagar el `Authorization` original
mediante OpenFeign. Una llamada interna sin token válido debe recibir `401`;
un token válido sin el rol requerido debe recibir `403`.

## Estados y transiciones

### Usuario

Estados:

```text
ACTIVO, INACTIVO
```

Transiciones permitidas:

```text
ACTIVO → INACTIVO
INACTIVO → ACTIVO
```

No se debe eliminar al último administrador activo ni permitir que un
administrador se quite a sí mismo el acceso administrativo sin una política
adicional.

### Cuenta

Estados actuales compatibles:

```text
ACTIVA, BLOQUEADA, INACTIVA
```

Estados objetivo de la siguiente fase:

```text
PENDIENTE_VERIFICACION, ACTIVA, BLOQUEADA, CONGELADA, INACTIVA, CERRADA
```

Transiciones objetivo:

```text
PENDIENTE_VERIFICACION → ACTIVA
ACTIVA → BLOQUEADA
ACTIVA → CONGELADA
ACTIVA → INACTIVA
ACTIVA → CERRADA
BLOQUEADA → ACTIVA
CONGELADA → ACTIVA
```

Una cuenta `CERRADA` no se reactiva. El cierre requiere saldo cero y ausencia
de operaciones pendientes u obligaciones asociadas.

### Transacción

Estados actuales compatibles:

```text
PENDIENTE, COMPLETADA, FALLIDA, CANCELADA
```

Estados objetivo:

```text
PENDIENTE, PROCESANDO, COMPLETADA, FALLIDA, CANCELADA, REVERTIDA, EN_REVISION
```

Reglas:

- `PENDIENTE → PROCESANDO → COMPLETADA`.
- `PENDIENTE → CANCELADA`.
- `PROCESANDO → FALLIDA`.
- `COMPLETADA → REVERTIDA`, únicamente mediante una operación compensatoria.
- Una transacción completada no se elimina ni se edita físicamente.

### Préstamo

Estados actuales:

```text
PENDIENTE, APROBADO, DESEMBOLSADO, RECHAZADO, PAGADO, VENCIDO
```

Estados objetivo:

```text
PENDIENTE, EN_REVISION, APROBADO, RECHAZADO, DESEMBOLSADO, PAGADO, VENCIDO, CANCELADO
```

Transiciones principales:

```text
PENDIENTE → EN_REVISION
EN_REVISION → APROBADO
EN_REVISION → RECHAZADO
APROBADO → DESEMBOLSADO
DESEMBOLSADO → PAGADO
DESEMBOLSADO → VENCIDO
PENDIENTE → CANCELADO
```

Solo `ADMIN` puede aprobar, rechazar o desembolsar. Cada decisión requiere
motivo y auditoría en la fase correspondiente.

## Respuestas de seguridad

Todas las APIs protegidas deben devolver una estructura JSON consistente:

```json
{
  "timestamp": "2026-10-20T12:00:00-05:00",
  "status": 401,
  "error": "UNAUTHORIZED",
  "message": "Autenticación requerida o token inválido",
  "path": "/api/cuentas"
}
```

- `401 UNAUTHORIZED`: token ausente, inválido o expirado.
- `403 FORBIDDEN`: token válido, pero sin permiso suficiente.

