# 1. Reconstruir la aplicación Angular

## 1.1 Entradas, proveedores y rutas

Angular organiza esta aplicación mediante componentes standalone. Cada componente declara sus imports; no debes asumir que importar Material en una pantalla lo vuelve disponible en las demás. app.config.ts registra los proveedores globales y el interceptor HTTP; app.routes.ts declara rutas con carga diferida. app.component.ts combina la navegación, el contenido de Router y el asistente.

Para estudiar el arranque sigue main.ts, app.config.ts, app.component.ts y app.routes.ts en ese orden. Identifica qué código se ejecuta antes de que aparezca una pantalla y cuáles componentes solo se descargan al navegar. Relaciona cada path con su loadComponent y con los guards que lo protegen.

En una reconstrucción completamente nueva puedes generar un proyecto con la versión de CLI declarada, pero el generador actual puede elegir herramientas de prueba distintas. Para reproducir fielmente esta versión conserva angular.json, los tsconfig, package.json y package-lock.json del repositorio, incluidos su builder y su configuración Karma/Jasmine.

```powershell
npx @angular/cli@21.2.30 new fintech-replica --standalone --routing --style=css --skip-git
# Compara después package.json, angular.json y los archivos de prueba.
# La configuración del repositorio es la referencia de esta edición.
```

Un modelo TypeScript no valida datos del servidor en tiempo de ejecución. Las interfaces de models.ts ayudan al compilador y al editor; las reglas de seguridad y las restricciones finales siguen en el backend. Si una respuesta no cumple el contrato, un cast de TypeScript no la transforma en una respuesta válida.

## 1.2 Capas del frontend

| Carpeta | Responsabilidad | Ejemplo |
| --- | --- | --- |
| pages | Flujo, plantilla y estado de una vista | cuentas.component.ts |
| services | HTTP, sesión y operaciones pendientes | cuenta.service.ts |
| models | Contratos y reglas reutilizables | models.ts, form-rules.ts |
| guards | Permitir o redirigir navegación | auth.guard.ts |
| interceptors | Política transversal de HTTP | auth.interceptor.ts |
| components | Elementos compartidos | navbar, confirmaciones, asistente |
| pipes | Presentación de un valor | cuenta-visible.pipe.ts |

El componente no necesita conocer el host del microservicio. Esa decisión pertenece al environment y al cliente HTTP. La separación permite sustituir la ruta en producción sin reescribir los formularios. Una función de importe reutilizable reduce divergencias, pero no elimina la necesidad de validación con BigDecimal en Java.

## 1.3 Anatomía de una pantalla real

Una pantalla combina variables de consulta, filtros, lista, indicadores de carga, mensajes y estado de diálogos. Al cambiar el filtro, reinicia la página; al cargar, cancela la consulta anterior; al recibir una respuesta, actualiza la lista y los totales. Si falla, conserva una vía visible para reintentar y distingue ese estado de un resultado vacío.

La primera pantalla que conviene reconstruir es una consulta con reintento. Usuarios y Alertas muestran patrones pequeños; Cuentas, Transacciones y Préstamos incorporan además confirmaciones e idempotencia. No empieces copiando el componente de préstamos completo sin entender su contrato de datos y su ciclo de vida.

# 2. Sesión, navegación y HTTP autenticado

## 2.1 Qué guarda AuthService

AuthService conserva fintech_user y fintech_token en sessionStorage. La sesión incluye identidad y rol para presentar la interfaz. Su comprobación local lee la expiración del JWT para evitar reutilizar uno ya expirado; no puede conocer por sí sola si el servidor cambió tokenVersion o desactivó al usuario.

El servidor resuelve esa vigencia. Si una API devuelve 401, el interceptor limpia la sesión y redirige al login, excepto para el propio intento de login. Un error 403 implica falta de permiso y no debería explicarse como un saldo insuficiente ni convertirse en autenticación exitosa.

sessionStorage está asociado al contexto de la pestaña y es accesible a JavaScript del mismo origen. No lo describas como una bóveda de secretos. Una vulnerabilidad XSS podría acceder al token. El diseño de producción requeriría evaluar su estrategia de sesión y otras defensas; esta edición documenta lo implementado, no propone cambiarlo silenciosamente.

## 2.2 Qué hace y qué no hace el interceptor

:::source frontend-angular/src/app/interceptors/auth.interceptor.ts

El interceptor añade el Bearer solo a rutas reconocidas de la API para no enviarlo a cualquier dominio. En producción las rutas relativas /api quedan cubiertas. Existe una limitación concreta del desarrollo: la expresión de URLs absolutas reconoce 8081 a 8084, pero no 8085 de Auditoría ni puertos alternativos del laboratorio. Si usas esos environment absolutos, adapta de forma controlada el reconocimiento de URLs o usa el mismo origen con proxy.

Esta observación no afecta la prueba de navegador realizada contra Nginx en 4300, donde las rutas son /api. Sí importa al reconstruir con ng serve: una auditoría con 401 puede deberse a que no se adjuntó el token. Comprueba la pestaña Network del navegador antes de modificar permisos del backend.

## 2.3 Guards y retorno seguro

authGuard permite la navegación de una sesión local vigente y redirige al login en otro caso. adminGuard además exige ADMIN. Las rutas de cuentas, movimientos y préstamos usan autenticación; Usuarios, Alertas y Auditoría agregan el guard administrativo. El servidor sigue comprobando cada petición aunque un atacante salte el router.

Cuando depures un acceso anota tres preguntas: ¿a qué URL navegó Angular?, ¿qué solicitud HTTP hizo realmente?, ¿qué código respondió el servicio? Una redirección de interfaz no es una prueba de autorización backend. El laboratorio incluye ambas comprobaciones.

# 3. Formularios que conservan la intención del usuario

## 3.1 Registro y acceso

El registro valida nombre, apellido, correo, teléfono opcional y longitud de contraseña. Normaliza espacios y el correo antes de enviarlo; bloquea un segundo submit mientras loading está activo. Un fallo conserva los campos y explica cómo reintentar o iniciar sesión si el registro pudo haberse completado. La navegación retardada tras el éxito se cancela si el componente se destruye.

El login también bloquea envíos repetidos y no navega al panel si la respuesta no declara autenticación. Un botón deshabilitado no es la única defensa: el método contiene su propio guard, porque puede invocarse por Enter, por otro evento o por código. El backend vuelve a comprobar las credenciales y su estado.

La recuperación utiliza formularios reactivos con Validators; el resto de varias pantallas usa FormsModule y NgForm. Son dos técnicas válidas y distintas. No agregues formControlName a un formulario de ngModel sin diseñar su integración. Para reset se comprueba también que la confirmación coincida y que el token esté presente.

## 3.2 Validación compartida de importes

:::source frontend-angular/src/app/models/form-rules.ts

importeValido rechaza vacíos, valores no finitos, mínimos y precisión excesiva. JavaScript usa Number y puede tener errores binarios, de ahí la tolerancia al verificar centavos. Esa validación sirve para ayudar al usuario; el servicio recibe decimal y valida nuevamente el rango y las dos posiciones decimales.

Una regla de formato no es una autorización. Que FT12345678 tenga la forma correcta no demuestra que exista ni permite mostrar el nombre o saldo del destinatario. La revisión de transferencia evita exponer datos privados del destino y solo entrega lo necesario para decidir y confirmar el movimiento.

## 3.3 Revisar antes de confirmar

Un formulario financiero tiene al menos dos fases: edición y revisión. En edición se eligen cuentas e importes; en revisión se muestran cuenta, moneda, costos estimados y efecto previsto. Solo la confirmación envía la operación de dinero. Si el usuario vuelve a editar, la revisión anterior deja de representar una confirmación válida.

En Cuentas, abrir una cuenta se revisa antes de enviarla. En Transacciones, revisarOperación consulta la previsualización sin mover dinero. En Préstamos, la cuenta activa determina la moneda; el cliente no cambia la tasa vigente. El tipo y el plazo siguen las reglas del backend, no un texto de ayuda arbitrario.

**Prueba indispensable:** intercepta el POST financiero y cuenta sus invocaciones. Antes de pulsar Confirmar debe haber cero. Un diseño bonito que mueve dinero al pulsar Revisar no cumple el flujo.

## 3.4 Qué significa resultado incierto

Un timeout no demuestra que el servidor no haya ejecutado la operación. Por eso hay servicios de pendientes para aperturas, movimientos y solicitudes. Guardan clave y payload antes de enviar; ante un resultado ambiguo permiten retomar exactamente esos datos. El usuario no debe iniciar una operación nueva para «ver si esta vez pasa».

:::source frontend-angular/src/app/services/solicitud-pendiente.service.ts

El navegador conserva la solicitud por usuario. La evidencia decisiva sigue siendo el backend y sus registros idempotentes. Si sessionStorage falla o no permite persistir, el formulario debe informar que no puede asegurar su recuperación. Cambiar de pestaña o limpiar almacenamiento no crea una garantía financiera; el endpoint conserva la intención ya registrada por su clave.

## 3.5 Cerrar, navegar y evitar respuestas tardías

Al destruir una pantalla se cancelan consultas de lectura y se cierran diálogos asociados. Cancelar la suscripción del navegador no revierte una escritura que ya llegó al servidor. Antes de permitir abandonar una confirmación financiera en curso, analiza cómo recuperará el usuario su resultado.

Usuarios conserva los datos editados cuando falla el guardado. Su consulta de cuentas limpia la lista anterior y cancela el request al cambiar de titular. Alertas conserva el motivo en el diálogo cuando el servidor falla. Las decisiones de bloqueo muestran un efecto distinto de resolver o descartar.

# 4. Consultas asíncronas, carga y recuperación

## 4.1 Cuatro estados de una lista

| Estado | Qué puede afirmar la pantalla | Qué no debe afirmar |
| --- | --- | --- |
| Cargando | Se está consultando el servidor | Que el saldo confirmado sea cero |
| Correcto con datos | La respuesta contiene estos registros | Que una muestra sea el historial completo |
| Correcto sin datos | No hubo coincidencias en esa consulta | Que el servicio falló |
| Fallido | No se pudo completar la consulta | Que no existen cuentas o préstamos |

Esta distinción evita decisiones basadas en una falsa ausencia de datos. El panel cliente oculta sus saldos hasta completar la consulta; si falla un servicio ofrece reintento en lugar de presentar contadores inicializados en cero como datos financieros. Los saldos de cuentas activas se separan por moneda y el conteo de cuentas incluye las existentes, no solo las activas.

## 4.2 Cancelar filtros anteriores

Supón que buscas PEN y enseguida USD. Si la consulta PEN termina después, puede sobrescribir la vista USD. Usuarios, Alertas y las listas bancarias cancelan la suscripción anterior antes de emitir la nueva. RxJS switchMap sirve para componer una consulta dependiente cuando su resultado decide la siguiente.

En el historial cliente, primero se consultan sus cuentas y después los movimientos de cada una. forkJoin reúne las respuestas y se deduplican por id porque una transferencia entre cuentas propias puede aparecer en dos listas. Si alguna consulta falla, el conjunto no se presenta como un resumen completo exitoso.

No interpretes unsubscribe como cancelación global del trabajo del servidor. Para una lectura evita que la respuesta anterior llegue a la pantalla; para una escritura sigue siendo posible que el servidor ya haya confirmado su efecto. La diferencia entre ambos casos es el centro del diseño de pendientes.

## 4.3 Esperas máximas y paginación

Las consultas revisadas tienen una espera máxima de 15 segundos para evitar spinners indefinidos. El fallo muestra Reintentar. Los endpoints y operaciones IA o financieras tienen otros presupuestos y deben leerse en sus servicios concretos; no conviene aplicar un único timeout universal sin estudiar su efecto.

La página de backend empieza en cero y la interfaz suele mostrar uno. Si resuelves el único elemento de la última página, el total puede disminuir: el componente consulta de nuevo una página válida. Los botones de paginación se deshabilitan durante carga y no deben permitir valores negativos ni más allá del total.

## 4.4 Errores visibles y verificables

Un snackbar puede acompañar una acción exitosa, pero un error que exige corregir un formulario debe permanecer junto a sus campos. Los mensajes no deben revelar stack traces, secretos ni respuestas crudas de proveedores. Los errores recuperables necesitan una acción concreta; «ocurrió un error» sin salida no completa el flujo.

Para probar un 503 no es necesario detener toda la aplicación. El recorrido de navegador simula una respuesta fallida solo para la petición estudiada, comprueba el estado visual y permite que el siguiente intento llegue al servidor real. Las pruebas unitarias usan HttpTestingController para reproducir el mismo contrato sin red.

# 5. Pantallas por rol y diseño de interfaz

## 5.1 Recorrido del cliente

El cliente entra al panel, consulta cuentas y saldos, abre una cuenta si la necesita y espera su activación. Una cuenta pendiente no habilita movimientos. Con cuenta activa puede revisar y confirmar operaciones, abrir un detalle y descargar su comprobante cuando corresponde. Puede solicitar un préstamo y seguir su cronograma tras desembolso.

En Préstamos, el cliente ve sus propios estados, pagos y opciones de cancelación permitidas. No ve la ficha administrativa interna. Las notificaciones personales enlazan detalles autorizados; abrir una notificación no elimina la necesidad de comprobar permiso en la API del recurso.

El asistente explica y orienta. Una recomendación del modelo no sustituye la confirmación ni cambia la tasa del formulario. El usuario puede abrir la fuente para contrastar un estado actual, porque una respuesta de IA puede referirse a una muestra o quedar desactualizada.

## 5.2 Recorrido del administrador

El administrador consulta métricas, gestiona perfiles, activa o restringe cuentas y atiende solicitudes. Antes de una decisión crediticia revisa la ficha interna, reconoce que la ha revisado y registra una observación. Aprobar no desembolsa: esta separación permite inspeccionar el resultado antes de acreditar fondos.

En Usuarios la acción se presenta como activar o desactivar acceso, no como borrar todo el cliente. Se muestra identidad y efecto antes de confirmar. En Alertas el diálogo diferencia resolver, descartar y bloquear cuenta; el motivo queda visible ante un fallo. Auditoría es una consulta de trazabilidad, no una pantalla para editar eventos históricos.

## 5.3 Sistema visual

La aplicación utiliza una paleta azul de banca digital, filtros compactos y controles avanzados desplegables. Los estilos globales relevantes son styles.css y minimal.css, además del tema Material y estilos de componente. El orden de carga importa: una regla posterior puede sobrescribir el color que viste en el componente.

Una tabla ancha puede tener desplazamiento horizontal dentro de su contenedor sin desbordar todo el documento. El menú responsive y los diálogos deben poder usarse en 390 px. Los nombres de acción largos, los números de cuenta y los mensajes de error son datos de prueba tan importantes como las tarjetas vacías de un mockup.

No dependas únicamente del color para comunicar riesgo o estado. Mantén texto, etiquetas accesibles, títulos del diálogo, foco y acciones de teclado. Material aporta infraestructura de diálogo y foco, pero no certifica automáticamente la accesibilidad de toda la pantalla.

# 6. Pruebas del frontend y ejercicios resueltos

## 6.1 Qué demuestra cada herramienta

Las pruebas Jasmine/Karma ejecutan componentes y plantillas en ChromeHeadless. HttpTestingController permite verificar URL, cabeceras, payload, cancelación y recuperación. Las pruebas del repositorio también comprueban reglas de importes y servicios de sesión o pendientes. No sustituyen una transferencia contra MySQL.

Los recorridos de navegador ejercitan vistas compiladas servidas por Nginx y las APIs reales. Se verificaron registro, apertura, activación, solicitud, permisos, decisiones, revocación y móvil. La edición de referencia registró 115 pruebas de frontend y 21 comprobaciones del recorrido global, además de los scripts HTTP. Son evidencia histórica, no una promesa de que cualquier copia modificada conservará esos resultados.

## 6.2 Ejercicios con respuesta

**Caso A:** una petición de cuentas devuelve 503. ¿Debes mostrar «No tienes cuentas»? No. Debes mostrar consulta no disponible y reintento; todavía no conoces el resultado.

**Caso B:** dos búsquedas terminan en orden inverso. ¿Cómo evitas datos del filtro anterior? Cancela su suscripción al iniciar la nueva, o compón los cambios con switchMap. Limpia estados y totales coherentemente.

**Caso C:** el usuario pulsa Confirmar dos veces. ¿Basta con disabled en HTML? No. Agrega un guard en el método y, para intención financiera, clave idempotente en servidor. Las dos defensas resuelven problemas distintos.

**Caso D:** falla el guardado de un motivo. ¿Cierras el diálogo? No. Conserva el texto, muestra el mensaje y deja una salida y una vía de recuperación. Si el resultado es ambiguo, consulta el estado antes de otra decisión.

**Caso E:** alguien cambia el rol guardado en sessionStorage. ¿Puede aprobar un préstamo? La pantalla podría presentar un estado local manipulado, pero el servidor debe verificar JWT, rol vigente y permiso del endpoint. Las pruebas de API son las que demuestran ese rechazo.

**Criterio de cierre del tomo:** reconstruye una lista con los cuatro estados y prueba una respuesta tardía, un timeout y un reintento exitoso. Luego documenta una apertura de cuenta completa sin asumir identificadores fijos ni usar saldo inicial arbitrario como cliente.
