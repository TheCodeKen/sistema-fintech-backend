# 1. Construir un servicio Spring Boot entendiendo sus capas

## 1.1 Recorrido de una petición

Un controlador HTTP traduce una petición a un caso de uso. El DTO expresa su contrato y sus restricciones sintácticas. El servicio comprueba reglas del dominio y decide qué leer o modificar. El repositorio ejecuta consultas contra la base. La respuesta se transforma a un DTO para exponer únicamente los datos necesarios.

Para reconstruir un módulo, escribe primero su pom.xml, aplicación principal y application.properties; agrega la migración inicial, la entidad y el repositorio; implementa un caso de uso; finalmente incorpora seguridad, validación y pruebas. Durante el aprendizaje puedes avanzar con una consulta local, pero no publiques una operación financiera sin autenticación y autorización.

Una anotación no es una regla mágica. @Service permite que Spring descubra el componente; @RequiredArgsConstructor genera un constructor para campos finales; @Transactional crea un límite transaccional mediante un proxy; @Valid solicita la validación del DTO. Debes entender cuándo se invoca cada mecanismo y qué casos quedan fuera de su alcance.

## 1.2 DTO, entidad y respuesta son objetos distintos

Una entidad Usuario contiene contraseña codificada y versión de sesión. UsuarioResponse no debe exponer esos datos. RegistroRequest no contiene un campo rol y siempre crea un CLIENTE. UsuarioRequest pertenece a administración y sí permite un rol. Reutilizar ciegamente el DTO administrativo en el registro permitiría introducir privilegios desde una petición pública.

Un DTO válido todavía puede representar una operación prohibida. Un monto positivo con dos decimales puede superar el saldo; un cuentaId existente puede pertenecer a otra persona; una moneda con tres letras puede no coincidir con la cuenta. Las anotaciones protegen el formato y el servicio protege el significado.

El tomo V reproduce contratos y entidades del código actual. Consulta sus tipos reales antes de escribir JSON. Un record Java usa sus componentes como contrato; Lombok no genera por sí mismo una validación de negocio ni una política de seguridad.

## 1.3 Persistencia y migraciones

El proyecto usa JPA/Hibernate para mapear entidades y Flyway para versionar el esquema. ddl-auto=validate comprueba que el esquema existente sea compatible; no lo crea ni lo corrige. Si agregas una columna, crea una migración nueva y ajusta el modelo. Editar V1 después de aplicarla cambia su checksum y puede impedir el arranque.

JPA administra una unidad de trabajo local. Cuando un método transaccional carga una entidad administrada y cambia su saldo, Hibernate puede persistir ese cambio por dirty checking al confirmar. La ausencia de un save explícito en cada línea no significa ausencia de escritura. A la inversa, una llamada a otro microservicio no se incorpora a esa unidad de trabajo.

BigDecimal representa dinero con operaciones decimales y redondeo explícito. Usa new BigDecimal("0.10"), no el constructor a partir de un double obtenido de un cálculo binario. Compara valores monetarios con compareTo; equals también compara escala, por lo que 10.0 y 10.00 pueden no ser iguales según ese método.

## 1.4 Laboratorio de una clase pequeña

Reconstruye CrearCuentaDTO siguiendo su referencia del tomo V. Después implementa un controlador que reciba el DTO y delegue en un servicio, sin alterar saldos. Comprueba que una petición incompleta produzca un error y que una entrada válida conserve su moneda. Solo después integra el repositorio y la apertura idempotente.

**Aceptación:** la entidad no sale directamente por HTTP; el error de validación tiene un formato que Angular pueda mostrar; el repositorio no recibe un usuario elegido por el cliente sin comprobar propiedad. La prueba negativa es parte del caso de uso, no un añadido opcional.

# 2. Identidad, permisos y sesiones revocables

## 2.1 Cómo se inicia y se valida una sesión

UsuarioService busca el correo, comprueba que el usuario esté activo y verifica la contraseña mediante BCrypt. Si coincide, genera un JWT que contiene identidad, rol y versión. La respuesta permite al frontend construir su sesión; la firma impide modificar los claims sin conocer el secreto.

BCrypt es un hash adaptativo con salt; no es un cifrado reversible. El backend compara la contraseña presentada con su hash usando PasswordEncoder.matches. Nunca recupera la contraseña original. La contraseña de demostración solo se utiliza para crear usuarios dev o para ejercicios aislados.

El JWT no es suficiente por sí solo para garantizar la vigencia de una sesión. JwtAuthenticationFilter de Usuarios consulta al usuario persistido, compara tokenVersion y rol, y rechaza usuarios inactivos. Los filtros de los otros servicios verifican la firma y consultan el endpoint de sesión de Usuarios. Cambiar contraseña, acceso o permisos invalida tokens anteriores mediante su versión.

:::source ms-usuarios/src/main/java/com/fintech/msusuarios/config/security/JwtAuthenticationFilter.java|35:67

Observa que el rol autorizado se incorpora como ROLE_ADMIN o ROLE_CLIENTE, y el identificador se coloca en authentication.details. Los helpers Acceso leen ese contexto. El usuario propietario de una petición no debe deducirse de un texto enviado en el cuerpo ni de un parámetro manipulable del navegador.

## 2.2 Tres controles diferentes

| Control | Pregunta que responde | Ejemplo |
| --- | --- | --- |
| Autenticación | ¿Quién presenta esta petición y sigue vigente su sesión? | JWT firmado y versión actual |
| Rol | ¿Puede esa clase de usuario ejecutar el caso de uso? | Solo ADMIN aprueba un préstamo |
| Propiedad | ¿Puede acceder a este recurso concreto? | CLIENTE consulta solo su cuenta |

Los guards de Angular mejoran la navegación, pero el backend debe repetir el control. Si un cliente pega una URL administrativa o usa curl, la regla sigue aplicándose. Un administrador tampoco obtiene por ello acceso al buzón personal de todos los clientes: NotificacionService identifica al destinatario desde su propia sesión.

Las llamadas internas incluyen X-Internal-Service y, en los recorridos financieros, propagan el Bearer del usuario. La clave interna no convierte cualquier petición anónima en un administrador. Los receptores de eventos son una excepción deliberada: sus endpoints permiten atravesar el filtro y después verifican explícitamente la clave dentro del controlador.

## 2.3 RequestContextHolder y Feign

Feign define interfaces con métodos HTTP. FeignClientInterceptor toma el Bearer de la petición actual usando RequestContextHolder y añade la clave interna desde el entorno. En ese punto estudias una API del framework para acceder al contexto ligado al hilo, no una clase que debas copiar desde spring-web.jar.

Si no hay petición HTTP activa, RequestContextHolder puede devolver null. Por ejemplo, un scheduler no debe asumir que puede reutilizar un Bearer de un navegador. Los outbox envían sus eventos con la credencial interna prevista para ese contrato. Este diseño explica por qué la entrega de auditoría no necesita una sesión interactiva vigente.

:::source ms-cuentas/src/main/java/com/fintech/mscuentas/config/FeignClientInterceptor.java

**Límite de seguridad que debes conocer:** el esquema compartido y la clave interna común simplifican desarrollo; no son identidades de servicio independientes con rotación granular. CORS amplio, HTTP local y ausencia de MFA tampoco equivalen a un despliegue bancario endurecido. Mantén esta instalación como entorno académico.

## 2.4 Recuperación y cambios de acceso

PasswordRecoveryService invalida tokens de recuperación anteriores, genera uno temporal y envía el enlace por correo. La respuesta pública no debe revelar si el correo existe ni devolver el enlace como sustituto del correo. En desarrollo el alumno lo abre desde Mailpit. Restablecer marca el token usado y aumenta tokenVersion para revocar sesiones anteriores.

Un reset token no es un JWT de sesión: tiene un propósito específico, expiración y uso único. No lo intercambies con el Bearer. Si una prueba vuelve a usar el enlace consumido, el servicio debe rechazarlo. El frontend valida confirmación y longitud de contraseña, mientras el backend vuelve a validar la entrada.

La desactivación de un usuario conserva sus cuentas y obligaciones. No borra dinero, transacciones o préstamos. El proyecto protege al último administrador activo usando bloqueo de administradores y comprobación de conteo. Las pruebas de acceso deben verificar tanto un nuevo login rechazado como un JWT anterior rechazado por otros servicios.

# 3. Cuentas: propiedad, estados e idempotencia

## 3.1 Modelo y apertura

Una cuenta almacena número FT, titular, tipo, saldo, moneda, estado y fecha. El número visible no es el id autoincremental. Las monedas admitidas son PEN y USD; no existe conversión. El cliente abre con saldo cero y el administrador puede crear con saldo inicial permitido por las validaciones del modelo académico.

La apertura crea PENDIENTE_VERIFICACION. El administrador activa después de revisar los datos. Esto no incluye una consulta de historial crediticio: esa evaluación se vincula a la concesión de préstamos, no a abrir una cuenta de depósito. Las integraciones regulatorias reales quedan fuera del proyecto.

AperturaCuentaService añade una capa idempotente sobre CuentaService. La clave opcional se combina con el actor; una huella SHA-256 representa los datos normalizados. La fila única serializa confirmaciones concurrentes y se consulta con FOR UPDATE en la misma transacción que crea la cuenta. Si la cuenta ya existe para esa clave, se devuelve su estado actual.

:::source ms-cuentas/src/main/java/com/fintech/mscuentas/service/AperturaCuentaService.java|24:47

La huella no cifra datos ni autentica usuarios: detecta que una clave se reenvíe con otra solicitud. Una clave nueva indica otra intención, por lo que no sirve para reintentar una confirmación cuya respuesta se perdió. Los clientes antiguos sin cabecera siguen una ruta de compatibilidad sin esa protección de apertura.

## 3.2 Estados y cierre

| Origen | Acción | Condición principal |
| --- | --- | --- |
| PENDIENTE_VERIFICACION o INACTIVA | Activar | Solo administración |
| ACTIVA o INACTIVA | Bloquear / congelar | Motivo de 5 a 500 caracteres |
| BLOQUEADA o CONGELADA | Desbloquear | Regresa a ACTIVA |
| Cualquier estado no cerrado | Cerrar | Saldo cero y sin obligaciones pendientes |
| CERRADA | Cambiar a otro estado | Rechazado |

Los cambios usan un bloqueo de la fila. Repetir un estado ya aplicado se resuelve sin generar otro cambio de estado. El cierre es lógico; se conserva el historial. Antes de cerrar se consulta a Préstamos por obligaciones que aún impedirían hacerlo. No basta con mirar solo el saldo del navegador.

Existe un método legado actualizarSaldo con reglas diferentes a aplicar un movimiento atómico. Debes distinguir sus contratos internos. El recorrido de transferencias moderno usa MovimientoService.aplicar, que exige cuentas ACTIVAS, misma moneda y saldo final válido. No conviertas una ruta heredada en una segunda API pública de dinero.

## 3.3 La transacción que protege dos saldos

MovimientoService recibe operacionId, origenId, destinoId, delta y moneda. Bloquea las cuentas ordenadas por id para reducir interbloqueos. Comprueba si la operación ya fue aplicada; si coincide la huella, termina sin volver a tocar el saldo. Si no coincide, rechaza la reutilización de clave.

:::diagram transfer

:::source ms-cuentas/src/main/java/com/fintech/mscuentas/service/MovimientoService.java

En una transferencia delta es negativo para origen y su opuesto se suma al destino. Las dos modificaciones y movimientos_aplicados se confirman juntas en MySQL. Un fallo antes del commit revierte las dos. Esa es la garantía local importante: no dos llamadas separadas que debiten una cuenta y acrediten otra sin una transacción común.

**Ejercicio resuelto.** A tiene 1000.00 y B 0.00. Aplicar delta -125.50 deja A=874.50 y B=125.50. Repetir la misma clave y huella conserva esos valores. Reutilizarla con -150.00 debe producir conflicto. No aceptes como prueba suficiente una respuesta 200: consulta ambos saldos.

# 4. Transacciones: intención, ejecución y compensación

## 4.1 Validar antes de mover fondos

TransaccionService.revisar devuelve una previsualización para el formulario: valida cuentas, propiedad, moneda y monto, y estima el saldo resultante. No confirma fondos ni reserva saldo. Entre la revisión y el envío pueden ocurrir otros movimientos; por eso crear y Cuentas deben volver a comprobar las reglas actuales.

POST /api/transacciones exige Idempotency-Key. El servicio conserva operacionId y una huella del payload. No elimines la descripción o la moneda de un reintento si formaban parte de los datos originales: cambiar el contenido puede cambiar su huella. La protección se basa en la misma intención y los mismos datos, no solo en el monto.

Las operaciones DESEMBOLSO_PRESTAMO y PAGO_PRESTAMO requieren el recorrido interno autorizado. El cliente no puede simular un desembolso enviando ese tipo desde su formulario. REVERSION tampoco se crea desde el endpoint genérico: tiene su endpoint administrativo y una referencia al movimiento original.

## 4.2 Máquina de estados y resultado ambiguo

La intención nace PENDIENTE y pasa a PROCESANDO antes de llamar a Cuentas. Una confirmación la marca COMPLETADA; un rechazo remoto definitivo la marca FALLIDA. Si hay un timeout o un fallo remoto ambiguo, el servicio conserva la posibilidad de repetir con la misma clave.

:::source ms-transacciones/src/main/java/com/fintech/mstransacciones/service/TransaccionService.java|139:166

El método de creación utiliza una política transaccional que preserva ciertos estados ante ResponseStatusException. No debes asumir que toda excepción provoca el mismo rollback. Lee las anotaciones del método completo y sus restricciones únicas. La transacción en Transacciones y la de Cuentas son distintas: un timeout puede ocurrir después de que Cuentas confirmara el dinero.

En ese caso, el segundo intento llega a movimientos_aplicados y no vuelve a aplicar los saldos. Transacciones puede entonces confirmar su registro pendiente. Se trata de reintentos con efecto idempotente; no de una garantía universal de entrega exactamente una vez entre procesos.

## 4.3 Reversión y comprobante

La reversión aplica un movimiento compensatorio con clave reversion:id. El original queda REVERTIDA y el nuevo registro apunta al original mediante transaccionPadreId. Se conservan ambos para explicar qué ocurrió. No se borra el movimiento ni se edita retroactivamente su importe.

No todas las operaciones permiten reversión independiente. Pagos y desembolsos de préstamos tienen consecuencias en otro dominio y el endpoint los excluye. Una reversión de transferencia también necesita que los estados, monedas y saldos permitan la compensación; no puede inventar fondos si el receptor ya los gastó.

ComprobanteService genera un PDF desde el detalle autorizado. El controlador usa application/pdf, descarga con nombre y cabeceras privadas/no-store. El comprobante refleja el estado actual y puede enlazar una reversión. No es una constancia de una red bancaria externa ni convierte una operación rechazada en completada.

## 4.4 Alertas antifraude

AntifraudeService aplica reglas deterministas como monto elevado, repetición de transferencias, movimiento significativo de una cuenta nueva e intentos fallidos. Los umbrales son configurables y dependen de la moneda. Las alertas señalan un patrón para revisión; no son una sentencia de fraude ni un modelo de aprendizaje automático.

AlertaService permite resolver, descartar o bloquear preventivamente. Bloquear consulta la cuenta y solicita su bloqueo a Cuentas, luego cierra la alerta. Esta operación cruza servicios y merece pruebas adicionales de concurrencia y recuperación antes de producción. En esta versión Alertas sigue dentro de Transacciones.

# 5. Préstamos, cuotas y evaluación del cliente

## 5.1 Solicitud y estados

Una solicitud identifica usuario, cuenta de desembolso, tipo, monto, tasa, plazo y moneda. La cuenta debe pertenecer al usuario, estar activa y tener la misma moneda. Para clientes se exige la tasa vigente de 18 % anual. SolicitudPrestamoService ofrece el mismo patrón de clave y huella para no duplicar solicitudes por reintentos.

El ciclo es PENDIENTE, EN_REVISION, APROBADO y DESEMBOLSADO. Una revisión también puede terminar RECHAZADO; solicitudes aún no desembolsadas admiten cancelación según rol. Un préstamo desembolsado puede pasar a VENCIDO y finalmente PAGADO. Las transiciones operativas bloquean la fila del préstamo para coordinar pagos y cambios de estado.

La aprobación es una decisión, no un movimiento de dinero. Desembolsar es un paso posterior. Repetir el desembolso utiliza la clave estable prestamo:id:desembolso, por lo que no debe acreditar dos veces. El cierre de la cuenta consulta obligaciones para evitar que una cuenta desaparezca del recorrido de un préstamo pendiente.

## 5.2 Cálculo financiero implementado

El proyecto calcula una cuota fija con tasa mensual derivada de la tasa anual nominal dividida entre doce y entre cien. No implementa TCEA, comisiones, seguros o un producto financiero contractual real. El cálculo emplea BigDecimal y reglas concretas de redondeo.

```text
i = tasaAnual / 12 / 100
factor = (1 + i)^n
cuota = capital * i * factor / (factor - 1)
si i = 0: cuota = capital / n
redondear cuota a 2 decimales con HALF_UP
```

:::source ms-prestamos/src/main/java/com/fintech/msprestamos/service/PrestamoService.java|345:353

La referencia de líneas es de esta edición; el bloque puede incluir la función inmediatamente vecina. Para capital 500, tasa 18 y plazo 3, la cuota resulta 171.69 y el total pactado 515.07. El interés implícito del ejemplo es 15.07. El total se obtiene a partir de las cuotas del modelo, no de una proyección de una central de riesgos.

## 5.3 Cronograma, pagos y vencimientos

El cronograma nace al desembolsar. Las fechas se calculan con plusMonths desde el día de origen, ajustando meses cortos. Los centavos se distribuyen de forma que la última cuota absorba el resto y la suma coincida con el total. El servicio valida la conciliación entre cuotas pendientes y saldo del préstamo antes de debitar.

Los pagos parciales cubren primero las cuotas más antiguas. PagoPrestamoDTO incluye cuentaId, monto y operacionId. Se crea una clave prestamo:id:pago:operacionId y se verifica su huella antes de llamar a Transacciones. Se conserva cuenta, fecha, importe y referencia de la transacción para poder explicar cada abono.

Una cuota con saldo se considera vencida cuando su fecha es anterior al día actual en America/Lima. Durante el día de vencimiento no está vencida. El scheduler revisa periódicamente; abrir el detalle también puede actualizar datos derivados. GET detalle no es completamente libre de efectos derivados en esta implementación, aunque no ejecute un pago.

Si el historial antiguo no permite reconstruir cuotas o conciliar importes, se informa la limitación y se bloquean nuevos débitos hasta resolverla. No inventes fechas de pagos históricos. El servicio no agrega recargos por mora ni calcula descuentos especiales por cancelación anticipada.

## 5.4 Evaluación interna y decisión manual

EvaluacionClienteService consulta los otros préstamos del mismo cliente, excluye la solicitud actual y separa resúmenes por moneda. Calcula obligaciones vigentes, cuotas vencidas reales y señales de cronogramas incompletos. El historial se pagina de veinte en veinte y los pagos recientes son una muestra acotada.

La ficha no se consulta para activar una cuenta ni se entrega al cliente como una evaluación administrativa. Solo ADMIN accede a /api/prestamos/id/evaluacion. La pantalla exige revisión del historial, decisión y observación para confirmar. El endpoint de aprobación conserva compatibilidad y puede aceptar observación opcional: la obligación de la pantalla no debe describirse como una condición idéntica en todos los clientes API.

**Ejercicio resuelto.** Un cliente sin antecedentes no es automáticamente moroso ni automáticamente solvente. La respuesta correcta es «sin historial registrado en esta aplicación». Dos préstamos de 100 PEN y 100 USD no forman una deuda de 200 PEN. La capacidad de pago requiere información y juicio adicional que este sistema no obtiene de una entidad externa.

# 6. Cómo demostrar que tu backend es correcto

## 6.1 Matriz mínima de pruebas negativas

Para cada endpoint relevante prueba: sin token, con cliente ajeno, con rol insuficiente, con entrada inválida, con recurso inexistente, con estado incompatible y con servicio remoto caído. Separa errores de formato 400, falta de autenticación 401, permiso 403, inexistencia 404, conflicto 409 y disponibilidad 502/503/504. La implementación concreta puede mapear algún fallo de identidad remota a 401.

Las pruebas unitarias aíslan repositorios o clientes remotos con Mockito. Son rápidas, pero no prueban un índice único o FOR UPDATE contra MySQL. Las pruebas HTTP del repositorio usan el entorno Docker real para concurrencia, saldos, restricciones, sesiones y reintentos. Necesitas las dos capas.

## 6.2 Casos numéricos que debes resolver sin la interfaz

- Transferir 125.50 de A=1000.00 a B=0.00 produce A=874.50 y B=125.50. La suma de saldos permanece en 1000.00 si no existen otros movimientos.
- Repetir la misma intención no cambia esos valores; reutilizar la clave con datos diferentes se rechaza.
- Un préstamo de 500 a tres meses y 18 % anual tiene el resultado de cuota del ejemplo, 171.69. Tras pagar esa cuota, la deuda del modelo queda en 343.38.
- Un pago superior a la deuda o financiado desde una cuenta ajena, bloqueada o de otra moneda se rechaza.
- Cancelar una solicitud conserva su registro y no acredita ni debita fondos.

**Criterio de cierre del tomo:** implementa una prueba donde Cuentas confirme pero el cliente no reciba la respuesta. Demuestra que el mismo identificador permite recuperar el resultado sin repetir el dinero y explica por qué un rollback de otro servicio no era una solución suficiente.
