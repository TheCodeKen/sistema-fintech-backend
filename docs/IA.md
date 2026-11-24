# Asistentes de IA para clientes y administradores

**Configuración local actual:** `AI_PROVIDER=ollama`, funcionando con respuestas del modelo local real, sin claves ni cargos de API. Consultar [OLLAMA.md](OLLAMA.md) para instalación, arranque, almacenamiento y verificación. Las secciones siguientes describen también la integración opcional con OpenAI y su diagnóstico anterior.

El botón **Asistente IA** abre un panel lateral azul desde cualquier vista autenticada. El cliente puede orientarse con formularios y explicar sus cuentas, movimientos y préstamos. El administrador dispone además de resúmenes operativos, alertas pendientes y solicitudes por revisar. Las respuestas muestran enlaces a las fuentes consultadas y distinguen orientación general de consultas con datos.

## Estado de esta entrega

La integración con OpenAI está implementada. Las pruebas de conversación utilizaron inicialmente un proveedor local simulado con el formato de Responses API; esa configuración se retiró al terminar. Posteriormente se configuró una clave real y el acceso al modelo respondió HTTP 200, pero la petición mínima de generación fue rechazada con HTTP 429, `credit_balance_exhausted` y `insufficient_quota`.

Se sustituyó el proveedor activo por Ollama local: se verificaron respuestas reales para guía de transferencias, cuentas propias, alertas y solicitudes de préstamos. No se necesita crédito de OpenAI para esta configuración. La integración opcional con OpenAI sigue pendiente de verificación de generación con saldo disponible; sus pruebas simuladas anteriores no equivalen a evaluar un modelo real.

### Si aparece un error del proveedor

El backend distingue saldo/cuota agotados de un límite temporal de solicitudes y de una credencial rechazada. No muestra mensajes crudos del proveedor ni fragmentos de la clave. `credit_balance_exhausted` indica que la organización no tiene crédito prepago disponible: revisar la organización de la clave, comprar o agregar crédito si corresponde y esperar a que el saldo se actualice. No hace falta cambiar la clave si el acceso al modelo ya respondió correctamente. La facturación de API es separada de ChatGPT; revisar las [instrucciones oficiales de créditos](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing) y la [separación de facturación](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).

## Activación opcional de OpenAI

Editar `.env` en el servidor, sin introducir la clave en el frontend ni compartirla en el chat:

```dotenv
AI_ENABLED=true
AI_PROVIDER=openai
OPENAI_API_KEY=tu_clave_real
AI_MODEL=gpt-5.4-mini
```

El modelo es configurable y debe admitir Responses API y function calling. Se eligió un modelo mini compatible para limitar el coste. La integración utiliza HTTP desde Java 17 y no añade SDK ni dependencia adicional.

Para actualizar solo usuarios en el entorno aislado ya utilizado, conservar sus puertos:

```powershell
$env:MYSQL_PORT='3407'
$env:PORT_8081='8181'; $env:PORT_8082='8182'
$env:PORT_8083='8183'; $env:PORT_8084='8184'
$env:FRONTEND_PORT='4300'; $env:MAIL_UI_PORT='8125'
$env:PASSWORD_RESET_FRONTEND_URL='http://localhost:4300/reset-password'
docker compose -p fintech-verificacion up -d --no-deps --wait ms-usuarios
```

Abrir `http://localhost:4300`, iniciar sesión y pulsar **Asistente IA**. Si el panel estaba abierto, usar **Reintentar conexión**. Configurar también un presupuesto y avisos de consumo en el proyecto del proveedor. Para desactivar el asistente, establecer `AI_ENABLED=false` y recrear usuarios. No hacen falta cambios ni migraciones en las bases de datos.

## Capacidades y permisos

| Agente | Consultas disponibles |
| --- | --- |
| Cliente | Guía de formularios, cuentas propias, muestra de movimientos y préstamos propios, detalle de un movimiento o préstamo autorizado |
| Administrador | Guía, métricas agregadas, alertas pendientes, solicitudes de préstamos y detalles permitidos por su rol |

El rol se obtiene de la sesión validada en el backend. Un cliente no puede activar el agente administrativo mediante el cuerpo de la petición o mediante instrucciones al modelo. Cada consulta de negocio utiliza únicamente `GET` y el JWT del usuario, sin la credencial interna de los microservicios. El servicio propietario vuelve a comprobar el permiso, incluidos los detalles por identificador.

No existen herramientas para transferir, depositar, pagar, aprobar, cancelar, bloquear o modificar saldos. Si el modelo pide una herramienta no autorizada, el backend la rechaza. Los argumentos admiten solo el esquema definido; no se aceptan URLs ni identificadores de otro usuario como filtros. Los formularios y las confirmaciones existentes siguen siendo la vía para realizar operaciones.

El detalle de préstamos puede actualizar sus datos derivados de cronograma o vencimiento según el comportamiento existente de ese endpoint, igual que al abrirlo en la aplicación; no ejecuta pagos ni cambia decisiones de aprobación.

## Datos y conversación

- La consulta de registros está desactivada inicialmente. El usuario puede habilitarla de forma explícita; sin ella solo se ofrecen herramientas de orientación general.
- Los mensajes escritos se envían a OpenAI. La interfaz lo indica y pide no incluir secretos. Se reducen los datos de negocio a campos expresamente seleccionados: esas proyecciones enmascaran cuentas y excluyen nombres, correos, descripciones libres, motivos, observaciones, identificadores de propietario y JWT. Esto no impide que un usuario escriba datos personales en su pregunta; debe evitar hacerlo.
- Se aplica además una redacción básica de correos, números de cuenta FT, tokens y claves en los mensajes. Esta redacción no es un detector completo de datos personales; no sustituye evitar escribir información sensible.
- Las métricas monetarias de cuentas separan PEN y USD. No se entrega al modelo el agregado de préstamos que mezcla monedas. Los detalles individuales conservan su moneda.
- Las listas son muestras acotadas: hasta seis cuentas, ocho movimientos de las primeras tres cuentas, cinco préstamos propios, diez alertas o cinco solicitudes por estado. La respuesta no debe presentarlas como un historial completo. Abrir las fuentes para verificar cifras y estados actuales.
- La conversación vive en memoria del panel y se descarta al cerrarlo, cambiar de sesión, cambiar de modo o cambiar la autorización de datos. No se guarda en la base ni en `sessionStorage`. Cada petición incluye como máximo los últimos seis turnos, tratados como contexto no confiable.
- Se solicita `store:false` al proveedor. Esto desactiva el almacenamiento de respuestas para recuperación por esa API; no se promete ausencia absoluta de retención por parte del proveedor. Revisar las condiciones de datos aplicables a la cuenta de OpenAI antes de usar información real.
- No se renderiza HTML del modelo. Las fuentes y enlaces se construyen en el servidor, se restringen a rutas internas en la interfaz y vuelven a aplicar permisos al abrirse.

## Orquestación y límites

El backend usa Responses API con herramientas de función y esquemas estrictos. Conserva los elementos de salida necesarios entre llamadas, devuelve los resultados de consulta asociados a su `call_id` y recoge la respuesta textual final. Revalida el nombre de herramienta, los argumentos, el modo y la autorización antes de cada consulta.

Hay un máximo de dos consultas de herramientas y tres llamadas al modelo por petición, con hasta 1800 tokens de salida por llamada. Se rechazan respuestas incompletas, vacías, excesivas o con herramientas incompatibles. El tiempo total se limita a 55 segundos, las llamadas individuales a 25 segundos para el proveedor y seis para los servicios, y cada respuesta HTTP a 1 MiB. No se siguen redirecciones ni se reintenta automáticamente una generación.

El límite local es de seis consultas por minuto y usuario, una consulta simultánea por usuario y cuatro globales. Estos límites son por instancia y se reinician al reiniciar el servicio; antes de escalar a varias instancias debe usarse un límite compartido. No equivalen a un presupuesto monetario del proveedor.

La interfaz conserva la pregunta cuando falla una consulta y muestra errores de disponibilidad, cuota o tiempo de espera. El endpoint de estado no revela la clave. Los errores crudos del proveedor y los encabezados de autorización no se muestran al usuario ni se registran por el código del asistente.

## API y configuración

| Ruta | Uso |
| --- | --- |
| `GET /api/usuarios/asistente/estado` | Disponibilidad, proveedor y permiso administrativo de la sesión |
| `POST /api/usuarios/asistente/chat` | `mensaje`, `modo` (`CLIENTE` o `ADMIN`), `consultarDatos`, `historial` |

El mensaje admite hasta 1200 caracteres y cada turno previo hasta 2400. Las variables normales son `AI_ENABLED`, `OPENAI_API_KEY` y `AI_MODEL`. `AI_RESPONSES_URL` permite cambiar el endpoint únicamente desde configuración confiable del servidor; se utilizó temporalmente para el proveedor simulado y no se expone a los usuarios. El endpoint final por defecto es `https://api.openai.com/v1/responses`.

Usuarios consulta las otras APIs mediante `SERVICES_CUENTAS_URL`, `SERVICES_TRANSACCIONES_URL` y `SERVICES_PRESTAMOS_URL`. Compose ya configura sus nombres internos. Nginx concede un tiempo de espera específico al endpoint del asistente.

## Verificación ejecutada — 14/11/2026

- 29 pruebas de usuarios/backend aprobadas, incluyendo permisos, privacidad, rechazo de escritura, argumentos inválidos, errores, límites de concurrencia, respuesta HTTP excesiva y tiempo máximo con cuerpo lento.
- 49 pruebas del frontend aprobadas, incluyendo autorización de datos, aislamiento de sesión, preguntas recuperables y prevención de envíos duplicados. La carga del asistente es diferida y el paquete inicial quedó por debajo del presupuesto de advertencia.
- 17 escenarios integrales con Responses API simulado: cliente y administrador, herramientas, rechazo de acceso ajeno, privacidad de payloads, ausencia de cambios de saldo y límite por usuario.
- Tres comprobaciones finales sin proveedor configurado: autenticación, estado sin secretos y error explícito de disponibilidad.
- Chrome: guía, consulta contextual de movimiento, fuentes, agente administrativo, cambio de sesión y móvil sin errores de JavaScript ni desbordamiento. Se inspeccionaron las capturas. También se comprobó visualmente el estado final sin clave.
- Se repitieron con éxito los 24 escenarios generales, 12 de transacciones y 11 de préstamos.

`python scripts/ai_smoke_test.py --url http://localhost:4300` comprueba autenticación y disponibilidad sin llamar a un modelo real. Su modo simulado requiere un proveedor de prueba local y un entorno desechable, y crea datos de demostración. Las pruebas unitarias incluyen dobles de proveedor reproducibles sin clave.

Fuentes de implementación: [inicio de OpenAI API](https://developers.openai.com/api/docs/quickstart), [function calling](https://developers.openai.com/api/docs/guides/function-calling), [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) y [modelo configurable por defecto](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

Quedan pendientes la prueba con una clave y modelo reales, evaluación de calidad con preguntas representativas, revisión de tratamiento de datos antes de usar cuentas reales y controles distribuidos si se amplía el despliegue. No se implementaron acciones autónomas, voz, navegación web ni envío de mensajes a terceros.
