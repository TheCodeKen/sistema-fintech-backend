# Interfaz y formularios

Se unificaron las vistas con un sistema visual en `frontend-angular/src/minimal.css`:
fondos claros, azul marino y azul medio inspirados en banca BBVA, bordes suaves, menos sombras, navegación lateral en
escritorio y navegación horizontal en móvil. Incluye acceso, registro, recuperación,
dashboard, cuentas, usuarios, movimientos, préstamos, auditoría y alertas.

## Flujos mejorados

Los filtros de cuentas, usuarios, movimientos, alertas y auditoría utilizan una
barra compacta. Las opciones secundarias se despliegan con «Más filtros»; se
conservan al cerrar el panel, muestran un contador y se restablecen con «Limpiar».
Aplicar o limpiar reinicia la paginación. Las fechas de inicio y fin se validan.
Se comprobó la consulta real por moneda, el restablecimiento y el panel móvil en Chrome.

- Cuentas: formulario con validación antes de enviar, mensajes locales, saldo cero
  para clientes y protección contra envíos repetidos.
- Usuarios: validación de datos de contacto, nombres normalizados, contraseña
  opcional al editar, estado de guardado y conservación de datos ante errores.
- Movimientos: selección de cuentas activas, moneda derivada de la cuenta,
  validación de saldo y decimales, rechazo de transferencias a la misma cuenta y
  pantalla de revisión antes de confirmar. Se conserva la clave al reintentar.
- Préstamos: selección de cliente y sus cuentas en lugar de IDs escritos a mano,
  moneda automática y límites de pago según la deuda y el saldo de la cuenta.
- Dashboard: tarjeta de préstamos fuera del enlace de administración, importes
  separados por moneda y movimientos recientes ordenados por fecha descendente.
- Confirmaciones: diálogos integrados en la aplicación para cerrar cuentas,
  desactivar usuarios y aprobar, rechazar o desembolsar préstamos; el rechazo
  solicita un motivo en el mismo diálogo, sin ventanas nativas del navegador.

Los selectores administrativos cargan hasta 200 registros. Para volúmenes mayores
conviene incorporar búsqueda paginada; no se modificó el contrato del backend.

## Verificación

Compilación de producción y 25 pruebas frontend, incluidas las plantillas de las
11 páginas, reglas de importes y revisión de movimientos. Se revisó la aplicación
en Chrome con ventanas de 1440 y 390 píxeles: acceso, dashboard, formularios de
cuentas y préstamos. Las capturas locales y logs están en `.verification`.

La vista previa mantiene el puerto 4300 y los servicios anteriores. No se cambia
el backend ni el esquema de datos en esta fase.

## IA: fase posterior acordada

No se añadió un chat simulado ni se conectó un proveedor de IA. Se acordó dejar
dos asistentes para la siguiente fase:

1. **Clientes:** explicar movimientos y estados, orientar formularios y responder
   preguntas sobre el funcionamiento de la plataforma, usando solo recursos propios.
2. **Administradores:** resumir alertas y solicitudes y preparar explicaciones con
   referencias a los registros consultados.

La integración futura debe tener proveedor y credenciales configurados en el
backend, controles de propiedad, herramientas de consulta explícitas y auditoría.
Las decisiones y movimientos financieros seguirán las reglas del sistema y las
acciones autorizadas del usuario. El modelo no debe cambiar saldos ni aprobar
préstamos por su cuenta.
