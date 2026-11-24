# 1. Plan de reconstrucción por sesiones

## 1.1 Método de trabajo y organización

Trabaja en una carpeta nueva y conserva una copia funcional del proyecto como referencia. No añadas simultáneamente todas las pantallas y servicios. Cada sesión tiene una entrada, una implementación acotada, un resultado observable y un rechazo que debes demostrar. La sesión termina cuando puedes explicar sus decisiones sin leer el código.

La duración depende de tus conocimientos. Usa bloques de estudio de aproximadamente dos horas, pero divide una sesión si no dominas sus conceptos. El objetivo no es memorizar anotaciones, sino conectar requisitos, contrato, persistencia, estado visual y pruebas. Las sesiones financieras pueden necesitar varios bloques.

| Sesión | Construcción principal | Resultado verificable |
| --- | --- | --- |
| 01 | Inventario y diagrama | Cinco servicios y cinco propietarios de datos |
| 02 | Entorno y configuración | Laboratorio aislado accesible |
| 03 | Esqueleto Usuarios | /health y migración aplicados |
| 04 | Registro y BCrypt | Contraseña no expuesta en respuestas |
| 05 | JWT y permisos | 401 y 403 explicados y comprobados |
| 06 | Revocación y recuperación | Token anterior rechazado |
| 07 | Cuentas y propiedad | Cuenta ajena inaccesible |
| 08 | Apertura idempotente y estados | Una cuenta por intención |
| 09 | Aplicación atómica de saldos | Dos saldos y una clave confirmados juntos |
| 10 | Transacciones y revisión | Revisar no mueve fondos |
| 11 | Reintentos y reversión | Respuesta perdida sin doble débito |
| 12 | Solicitudes de préstamo | Condiciones y moneda validadas |
| 13 | Evaluación y decisiones | Separar aprobación de desembolso |
| 14 | Cuotas, pagos y reloj | Conciliación y vencimiento comprobados |
| 15 | Angular y navegación | Acceso diferenciado por rol |
| 16 | Formularios financieros | Edición, revisión y confirmación |
| 17 | Consultas y errores | Sin falsas listas vacías |
| 18 | Auditoría y notificaciones | Reentrega deduplicada |
| 19 | IA autorizada | Consulta útil y acción prohibida rechazada |
| 20 | Operación y defensa del proyecto | Pruebas reproducibles y límites documentados |

## 1.2 Sesiones 01-03: estructura mínima

1. Dibuja qué proceso recibe cada prefijo /api y escribe las URLs desde navegador, host y contenedor. No uses localhost como respuesta universal.
2. Crea una carpeta por módulo con su pom.xml y package base. Conserva Java 17 y Spring Boot 3.2.5 de esta edición. En los módulos que los necesitan incorpora BOM de Spring Cloud y OpenFeign según el pom real.
3. Define application.properties con nombre, puerto y datasource. Agrega Flyway y la migración del esquema del módulo. Usa validate para Hibernate.
4. Escribe la clase principal con @SpringBootApplication y HealthController. Verifica el proceso y su conexión de datos antes de construir reglas financieras.

**Prueba de cierre:** ejecuta Maven y consulta /health en el puerto directo del servicio. Si falla el arranque por una tabla, identifica si falta el esquema, la migración o la credencial. No «soluciones» el fallo activando ddl-auto=update sin comprender la migración.

## 1.3 Sesiones 04-06: identidad vertical completa

Construye Usuario, RegistroRequest, LoginRequest y UsuarioResponse siguiendo el anexo. Añade UsuarioRepository y UsuarioService. Explica por qué el registro público no acepta rol y por qué la contraseña codificada nunca forma parte de la respuesta.

Después incorpora JwtUtil, el filtro y SecurityConfig. Crea un cliente y usa su sesión para probar un endpoint administrativo. El resultado correcto es 403; una petición sin sesión debe devolver 401. Cambia el estado del cliente y verifica que su token anterior deja de funcionar también en Cuentas.

Para recuperación, agrega PasswordResetToken y el flujo de uso único. Solicita un enlace, recógelo en Mailpit del laboratorio y cambia la contraseña. Intenta usar de nuevo el mismo token y la contraseña anterior. Registra cada código HTTP y explica qué prueba aporta cada rechazo.

**Errores que debes poder detectar:** guardar password en texto plano, generar rol desde el cuerpo del registro, aceptar JWT sin comprobar vigencia o devolver un enlace privado en la respuesta pública de recuperación.

## 1.4 Sesiones 07-09: Cuentas y consistencia local

Implementa entidad, migración y consultas por titular. El servicio debe identificar si el actor es propietario, administrador o servicio interno según el contrato. Agrega apertura con clave y huella antes de habilitar reintentos del formulario. Comprueba que una clave existente no permita cambiar titular, moneda o saldo inicial.

Construye la transición de estados como una regla explícita, no como un setter accesible por HTTP. Después implementa MovimientoService con bloqueo ordenado, validación de moneda y saldo y tabla de operaciones aplicadas. Repite el movimiento y compara ambos saldos antes y después.

**Ejercicio de concurrencia:** envía varios intentos con la misma clave. El resultado esperado es un solo efecto. Luego envía otra intención que competiría por el mismo saldo; el conjunto no puede dejar un saldo negativo. Una prueba con mocks no demuestra que los bloqueos y la unicidad de MySQL funcionen.

## 1.5 Sesiones 10-14: orquestación financiera

En Transacciones implementa primero la revisión sin escritura, después la intención con clave, su llamada atómica a Cuentas y el tratamiento de resultado pendiente. Estudia el significado de noRollbackFor en el método antes de copiarlo. Agrega reversión compensatoria con vínculo al original y comprobante autorizado.

En Préstamos implementa solicitud, revisión, aprobación/rechazo y desembolso como pasos distintos. Reproduce el cálculo de cuota con el ejemplo conocido y su redondeo. Añade el cronograma y valida que su saldo pendiente concilie antes de aceptar pagos. Usa Clock para probar un vencimiento sin depender del día de la ejecución.

La evaluación administrativa debe excluir la solicitud actual y separar monedas. Una persona sin registros tiene ausencia de historial interno, no una calificación crediticia favorable o desfavorable inventada. La prueba debe comprobar también que el cliente no puede acceder al endpoint de evaluación.

## 1.6 Sesiones 15-17: interfaz que no miente sobre el resultado

Construye una consulta de cuentas antes de añadir el formulario de apertura. Después integra login, guards y el interceptor. En cada servicio Angular configura el environment adecuado para tu laboratorio. Si una petición no lleva Bearer, corrige su clasificación de URL en lugar de retirar autorización del servidor.

En los formularios financieros implementa edición, revisión y confirmación. Antes del envío conserva clave y payload. Simula una respuesta perdida después de que el servidor haya confirmado; recarga la página y retoma. No generes otra clave para ese intento.

Prueba listas con datos, sin datos, con 503 y con petición que nunca termina. Cambia rápidamente filtros para comprobar respuestas tardías. Revisa el diálogo en 390 px y utiliza teclado. Guarda una captura del caso fallido y otra de la recuperación; un dashboard vacío no demuestra que los formularios funcionen.

## 1.7 Sesiones 18-20: integraciones y cierre

Conecta Auditoría mediante outbox. Detén el receptor, confirma una operación del productor y verifica su pendiente persistente. Reinicia el productor y recupera el receptor. Demuestra deduplicación y retirada de eventos confirmados, no solo que «el contenedor volvió a arrancar».

Añade notificaciones con destinatario desde sesión y lectura masiva hasta una frontera. Incorpora IA al final, cuando las APIs y permisos ya estén probados. Evalúa una guía sin datos, una consulta propia, un modo administrativo prohibido y una instrucción para mover dinero. El asistente no debe convertirse en una nueva vía de escritura.

Prepara tu defensa explicando tres fallos: respuesta de transferencia perdida, receptor de auditoría caído y token revocado. Para cada uno indica dónde está la evidencia persistente, quién reintenta y qué límite tiene la solución. Es una explicación más valiosa que enumerar tecnologías sin conectar sus responsabilidades.

# 2. Laboratorio HTTP completo con saldos verificables

## 2.1 Preparación y función auxiliar

Este laboratorio se propone para fintech-estudio en http://localhost:4400. Crea usuarios y fondos de demostración; no lo ejecutes sobre datos reales. Necesita perfil dev para el administrador de ejemplo. La función permite usar el mismo contrato sin depender de la interfaz ni de un alias curl de PowerShell.

```powershell
$base='http://localhost:4400'
function Api($method,$path,$body=$null,$headers=@{}) {
    $params=@{
        Method=$method
        Uri=($base+$path)
        Headers=$headers
        ContentType='application/json; charset=utf-8'
    }
    if ($null -ne $body) {
        $params.Body=($body | ConvertTo-Json -Depth 8)
    }
    Invoke-RestMethod @params
}
$admin=Api 'POST' '/api/usuarios/login' @{
    email='admin@fintech.pe'; password='admin123'
}
$ha=@{Authorization=('Bearer '+$admin.token)}
$tag=[guid]::NewGuid().ToString('N').Substring(0,8)
$a=Api 'POST' '/api/usuarios/registro' @{
    nombre='Alumno'; apellido='Uno'
    email=('alumno-a-'+$tag+'@example.test'); password='Prueba123!'
}
$b=Api 'POST' '/api/usuarios/registro' @{
    nombre='Alumno'; apellido='Dos'
    email=('alumno-b-'+$tag+'@example.test'); password='Prueba123!'
}
$h1=@{Authorization=('Bearer '+$a.token)}
$h2=@{Authorization=('Bearer '+$b.token)}
```

Comprueba autenticado y rol en las respuestas sin imprimir tokens en un informe compartido. Conserva los identificadores que devuelven: no uses 1 y 2 suponiendo que son tus usuarios. Cada repetición del laboratorio utiliza un sufijo nuevo para que un correo duplicado no confunda el resultado.

## 2.2 Abrir y activar cuentas

```powershell
$h1['Idempotency-Key']=[guid]::NewGuid().ToString()
$c1=Api 'POST' '/api/cuentas' @{
    usuarioId=$a.usuarioId; tipoCuenta='AHORROS'
    moneda='PEN'; saldoInicial=0
} $h1
$h2['Idempotency-Key']=[guid]::NewGuid().ToString()
$c2=Api 'POST' '/api/cuentas' @{
    usuarioId=$b.usuarioId; tipoCuenta='AHORROS'
    moneda='PEN'; saldoInicial=0
} $h2
Api 'PATCH' ('/api/cuentas/'+$c1.id+'/activar') $null $ha
Api 'PATCH' ('/api/cuentas/'+$c2.id+'/activar') $null $ha
```

Antes de activar, la cuenta no debe permitir el recorrido financiero normal. La activación administrativa es explícita. Comprueba además que el cliente A no pueda consultar la cuenta de B por id. Que ambos clientes existan y sus cuentas tengan números válidos no otorga permiso cruzado.

## 2.3 Depósito, transferencia y repetición

```powershell
$h1['Idempotency-Key']=[guid]::NewGuid().ToString()
$deposito=Api 'POST' '/api/transacciones' @{
    numeroCuentaOrigen=$c1.numeroCuenta
    tipoTransaccion='DEPOSITO'; monto=1000
    descripcion='Fondos de demostracion del laboratorio'
} $h1
$h1['Idempotency-Key']=[guid]::NewGuid().ToString()
$transferencia=@{
    numeroCuentaOrigen=$c1.numeroCuenta
    numeroCuentaDestino=$c2.numeroCuenta
    tipoTransaccion='TRANSFERENCIA'; monto=125.50
    descripcion='Transferencia de estudio'
}
$tx=Api 'POST' '/api/transacciones' $transferencia $h1
$repetida=Api 'POST' '/api/transacciones' $transferencia $h1
Api 'GET' ('/api/cuentas/'+$c1.id) $null $h1
Api 'GET' ('/api/cuentas/'+$c2.id) $null $h2
```

**Resultados esperados:** tx y repetida corresponden al mismo movimiento; A tiene 874.50 y B 125.50. Si cambias monto conservando la cabecera, se debe rechazar el cambio de contenido. Si borras la cabecera del POST genérico, se rechaza la petición por faltar la clave.

```powershell
$reversion=Api 'POST' ('/api/transacciones/'+$tx.id+'/revertir') $null $ha
Api 'GET' ('/api/transacciones/'+$tx.id+'/detalle') $null $h1
```

Tras la reversión inmediata, A vuelve a 1000.00 y B a 0.00. El original queda REVERTIDA y existe una compensación vinculada. Si repites revertir el mismo original, no debe aparecer un segundo efecto de dinero. La descarga de comprobante se prueba desde la interfaz o guardando el binario con un cliente HTTP, no interpretándolo como JSON.

## 2.4 Préstamo: decisión y dinero separados

```powershell
$h1['Idempotency-Key']=[guid]::NewGuid().ToString()
$p=Api 'POST' '/api/prestamos' @{
    usuarioId=$a.usuarioId; cuentaDesembolsoId=$c1.id
    montoSolicitado=500; tasaInteres=18; plazoMeses=3
    tipoPrestamo='PERSONAL'; moneda='PEN'
} $h1
Api 'GET' ('/api/prestamos/'+$p.id+'/evaluacion') $null $ha
Api 'PATCH' ('/api/prestamos/'+$p.id+'/revisar') $null $ha
Api 'PATCH' ('/api/prestamos/'+$p.id+'/aprobar') @{
    observacion='Historial interno revisado para ejercicio academico'
} $ha
Api 'POST' ('/api/prestamos/'+$p.id+'/desembolsar') @{} $ha
$pago=@{
    cuentaId=$c1.id; monto=171.69
    operacionId=[guid]::NewGuid().ToString()
}
Api 'POST' ('/api/prestamos/'+$p.id+'/pagar') $pago $h1
Api 'POST' ('/api/prestamos/'+$p.id+'/pagar') $pago $h1
Api 'GET' ('/api/prestamos/'+$p.id+'/detalle') $null $h1
```

**Resultados esperados de esta secuencia:** después de la reversión y antes del préstamo A tenía 1000.00. El desembolso lo deja en 1500.00. Un pago de 171.69 lo deja en 1328.31 y reduce la deuda de 515.07 a 343.38. Repetir pago con la misma operacionId conserva esos valores. El detalle debe mostrar cronograma e historial, no dos abonos iguales.

No uses este ejemplo para afirmar que toda tasa o plazo arroja el mismo interés. Cambia capital, plazo o tasa solo como una solicitud nueva. Prueba cancelar antes de desembolsar en otra solicitud y comprueba que no cambia los saldos.

## 2.5 Evidencia negativa y asincronía

Consulta evaluación con el token de cliente: debe rechazarse. Intenta pagar desde la cuenta de B: debe rechazarse. Crea una cuenta USD y demuestra que no permite pagar el préstamo PEN. Para esos rechazos conserva el estado previo y comprueba que saldo y deuda no cambiaron.

La auditoría y las notificaciones pueden aparecer segundos después del cambio financiero. Consulta por acción, actor y entidad; no asumas que tu evento está en la primera página si otros ejercicios se ejecutan a la vez. El evento local pendiente y el diario receptor son evidencias diferentes del recorrido.

# 3. Diccionario de conceptos con aplicación concreta

| Concepto | Significado dentro de este proyecto |
| --- | --- |
| Invariante | Condición que no debe romperse, como saldo no negativo |
| DTO | Contrato HTTP distinto de una entidad persistente |
| Entidad | Objeto que representa datos administrados por JPA |
| Repositorio | Interfaz de acceso a persistencia y consultas |
| Bean | Objeto administrado e inyectado por Spring |
| Inyección de dependencias | Recibir colaboradores sin construirlos manualmente en cada método |
| Transacción local | Unidad de confirmación dentro de una base del servicio |
| Dirty checking | Persistencia de cambios en entidades administradas al confirmar |
| Bloqueo pesimista | Exclusión temporal de una fila para coordinar escrituras |
| Interbloqueo | Espera circular entre operaciones por recursos bloqueados |
| Idempotencia | Repetir una intención sin repetir su efecto |
| Huella | Resumen para detectar cambio de contenido con la misma clave |
| Compensación | Nueva operación que contrarresta otra sin borrarla |
| Outbox | Registro local persistente de un evento por entregar |
| Consistencia eventual | Propagación posterior que converge bajo las condiciones del diseño |
| JWT | Token firmado que transporta claims de sesión |
| Claim | Dato del token, como rol o versión |
| BCrypt | Hash adaptativo utilizado para contraseñas |
| Autenticación | Verificación de identidad y vigencia de sesión |
| Autorización | Decisión de permitir una acción o acceso concreto |
| Propiedad | Relación entre recurso y usuario autorizado |
| Revocación | Invalidación de un token antes de su expiración natural |
| Proxy inverso | Nginx recibe una ruta y la dirige al backend adecuado |
| Observable | Secuencia de RxJS que puede emitir respuesta o error |
| Subscription | Participación que puede cancelarse para dejar de recibir emisiones |
| switchMap | Sustituye una consulta anterior por la nueva dependiente |
| forkJoin | Reúne resultados finales de consultas que deben completarse |
| Guard | Control de navegación de Angular, complementario al backend |
| Interceptor | Política HTTP transversal, como adjuntar Bearer |
| Standalone | Componente Angular con dependencias declaradas en sus imports |
| CSR | Renderizado de vistas en el navegador; Nginx necesita fallback de rutas |
| Tool calling | El modelo solicita una función que el backend valida y ejecuta |
| Allowlist | Conjunto cerrado de herramientas o destinos admitidos |
| Prompt injection | Intento de alterar reglas mediante texto no confiable |
| Healthcheck | Comprobación concreta del estado de un proceso o dependencia |
| RPO | Cantidad máxima de datos recientes que se admite perder |
| RTO | Tiempo objetivo para restablecer una capacidad del sistema |
| Migración | Evolución versionada del esquema de datos |
| Smoke test | Comprobación de integración de recorridos significativos |
| Mock | Sustituto controlado de un colaborador durante una prueba |

# 4. Evaluación final, respuestas y rúbrica

## 4.1 Preguntas de defensa con respuesta orientativa

**1. ¿Por qué no se modifica el saldo desde Angular?** Porque el navegador no es una autoridad confiable ni coordina transacciones de base. Envía una intención; Cuentas aplica y valida el efecto.

**2. ¿Por qué la tabla de operaciones aplicadas está en Cuentas?** Porque comparte la misma transacción que los saldos. Ponerla solo en otro servicio no impediría repetir el efecto tras una respuesta remota perdida.

**3. ¿Qué demuestra un evento duplicado sin fila duplicada?** Que el receptor deduplicó bajo el identificador y contenido probados. No demuestra que toda la red entregue exactamente una vez ni que nunca puedan perderse datos por pérdida del disco.

**4. ¿Qué sucede si firmas un token válido de un usuario desactivado?** La validación de estado y versión debe rechazarlo. La firma solo acredita integridad del token respecto al secreto, no vigencia de su sesión en la base.

**5. ¿Por qué una reversión es otro registro?** Para conservar trazabilidad, vincular el efecto compensatorio y evitar reescribir el historial de lo que ya ocurrió.

**6. ¿Aprobar es acreditar?** No. Aprobar permite pasar a desembolso; el desembolso hace la operación interna de dinero y fija las fechas del cronograma.

**7. ¿El historial interno es una central de riesgos?** No. Solo contiene registros del proyecto y puede estar incompleto respecto a la vida crediticia externa.

**8. ¿Una prueba con un modelo simulado evalúa Ollama?** Evalúa el contrato y parte del control de herramientas, no latencia, calidad o robustez del modelo real.

**9. ¿Por qué no se convierte automáticamente PEN a USD?** No existe un servicio ni regla contractual de conversión. Mezclar saldos o deudas sin moneda produciría cifras falsas.

**10. ¿Qué debes hacer ante un commit remoto y un timeout local?** Recuperar la misma intención con su clave y consultar evidencia. Repetir con otra clave puede duplicar el efecto.

**11. ¿Qué ocurre al perder el equipo completo?** Los eventos, bases y respaldos locales pueden perderse juntos. Esta versión necesita recuperación externa de todos los esquemas y claves para cubrir ese escenario.

**12. ¿Por qué una API GET puede tener efectos derivados aquí?** El detalle de Préstamos puede preparar o actualizar cronograma/vencimiento. Es una característica concreta que se debe conocer y considerar al diseñar caché o herramientas de lectura.

## 4.2 Rúbrica para tu réplica

| Dimensión | Evidencia para considerarla lograda |
| --- | --- |
| Comprensión | Explicas propietarios, dependencias y límites sin memorizar rutas |
| Reproducción | Arrancas una copia aislada con puertos y secretos propios |
| Seguridad | Pruebas usuarios ajenos, roles insuficientes y sesiones revocadas |
| Consistencia | Demuestras atomicidad, clave/huella y recuperación de resultado incierto |
| Finanzas del modelo | Concilias saldos, cuotas, intereses pactados y pagos |
| Frontend | Conserva formularios, cancela lecturas antiguas y distingue errores |
| Integraciones | Eventos y herramientas autorizadas funcionan con límites conocidos |
| Verificación | Puedes repetir pruebas y explicar qué no certifican |
| Comunicación | Documentas una decisión, su alternativa y su coste práctico |

Antes de dar tu réplica por terminada, verifica que no necesita ids fijos, tu carpeta personal de Maven, una clave copiada del manual ni un modelo ya descargado en otro equipo. Una instalación reproducible distingue archivos del proyecto, dependencias descargables y estado persistente.

# 5. Comandos de verificación y solución de problemas

## 5.1 Suite y resultados de referencia

```powershell
python scripts/smoke_test.py --url http://localhost:4400 --mail http://localhost:8225
python scripts/user_smoke_test.py --url http://localhost:4400
python scripts/account_smoke_test.py --url http://localhost:4400
python scripts/transaction_smoke_test.py --url http://localhost:4400
python scripts/loan_smoke_test.py --url http://localhost:4400
python scripts/notification_smoke_test.py --url http://localhost:4400
```

Los seis scripts sumaron noventa comprobaciones HTTP en fintech-verificacion: 24 generales, 12 de usuarios, 12 de cuentas, 12 de transacciones, 18 de préstamos y 12 de notificaciones. La última ronda registrada de interfaz tuvo 115 pruebas y 21 comprobaciones del recorrido global en Chrome. Usuarios pasó cuarenta pruebas Maven tras la corrección de búsqueda.

La documentación histórica registra también pruebas de los otros módulos y de operación. No todos esos resultados se ejecutaron nuevamente para producir este PDF: esta tarea revisó y documentó el código y sus evidencias existentes. Repite las suites en tu réplica; no uses el número impreso como sustituto de su ejecución.

La CI actual ejecuta Maven por los cinco servicios, compilación y pruebas del frontend, pruebas unitarias operativas y los smoke generales y de Usuarios. Los demás scripts se ejecutan por separado; no se afirma que toda la matriz de noventa esté ya incorporada como pasos de CI.

## 5.2 Tabla de diagnóstico

| Síntoma | Hipótesis que debes comprobar | Evidencia útil |
| --- | --- | --- |
| Docker API no disponible | Docker Desktop detenido | docker version |
| Puerto ocupado | Otro proyecto publica el mismo host:puerto | docker compose ps y procesos del host |
| Access denied MySQL | Credencial distinta de la guardada en volumen | Log del servicio y configuración efectiva |
| Esquema Auditoría ausente | init-db no volvió a ejecutarse en volumen usado | Bases existentes y migrate_audit --prepare |
| Flyway checksum mismatch | Se editó una migración aplicada | flyway_schema_history y diff del archivo |
| 401 en Auditoría con ng serve | El interceptor no reconoció 8085 | Cabecera Authorization en Network |
| 502 desde /api | Backend aún no disponible o URL errónea | Nginx y logs del servicio |
| Spinner indefinido en tu réplica | Falta de límite o de callback de error | Suscripción y timeout de lectura |
| Doble débito | Se perdió o se cambió la clave | Payload, operacion_id y movimientos_aplicados |
| Pago rechazado por conciliación | Cuotas y saldo no coinciden | Cronograma e historial del préstamo |
| IA «no disponible» | Proceso/modelo/URL o proveedor no configurado | ollama list y /asistente/estado |
| Cola crece | Receptor o clave interna incorrectos | audit_status y eventos_pendientes |
| Correo no llega fuera de Docker | Mailpit SMTP no está publicado al host | Puerto SMTP y configuración de red |
| Python abre una consola | Tarea usa python.exe o hijos visibles | Acción programada y creationflags |

## 5.3 Preguntas aún pendientes de una versión productiva

El proyecto no incluye una red de pagos real ni una evaluación regulatoria. Permanecen por estudiar carga sostenida, recuperación externa de todos los esquemas, identidades de servicio separadas, TLS y permisos endurecidos, catálogos de selección grandes, concurrencia entre administradores y accesibilidad con lector de pantalla.

La IA exige evaluación sistemática de alucinación e inyección con el modelo real. Los secretos necesitan gestión y rotación adecuadas al despliegue. Auditoría necesitaría requisitos de retención y protección acordes a su uso real. Esta lista es una frontera de alcance, no una razón para confundir el laboratorio académico con una plataforma bancaria certificada.

# 6. Fuentes, trazabilidad y uso del anexo

## 6.1 Fuentes primarias del manual

La fuente principal es el código propio del repositorio en esta edición: los cinco src/main, pruebas, package.json y lock, configuraciones de Angular, Dockerfile, Compose, Nginx, migraciones y scripts. Se contrastaron las guías temáticas de docs, distinguiendo información histórica de la implementación actual. No se incorporó .env real, datos de clientes ni volcados de bases.

El anexo se genera desde esos archivos: catálogo de rutas, DTO, entidades, migraciones, inventario y configuración de dependencias, frontend, backend y contenedores. Esto permite localizar una regla y contrastar su implementación. Las firmas extraídas no sustituyen SecurityConfig; en rutas internas la clave puede comprobarse también en controlador o Acceso.

## 6.2 Lecturas oficiales complementarias

- [Spring Boot 3.2.5: documentación de referencia](https://docs.spring.io/spring-boot/docs/3.2.5/reference/htmlsingle/). Utiliza la versión del proyecto al estudiar auto-configuración y propiedades.
- [Angular: anatomía de componentes](https://angular.dev/guide/components). Contrasta la documentación viva con el package.json de esta edición.
- [Docker Compose: documentación](https://docs.docker.com/compose/). Consulta redes, volúmenes, overrides y ciclo de vida.
- [MySQL 8.0: bloqueos de InnoDB](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html). Relaciona bloqueo de filas con las transacciones del laboratorio.
- [Ollama: referencia de API](https://docs.ollama.com/api/introduction). Distingue API local de servicios cloud y compatibilidad del endpoint utilizado.

Las explicaciones de las reglas de FinTechPro se derivan del código propio; estas fuentes externas amplían los fundamentos y no validan automáticamente todas las decisiones del proyecto. Las páginas oficiales pueden evolucionar después de esta edición.

## 6.3 Cómo mantener tu documentación

Cuando cambies una regla, actualiza su DTO, servicio, pantalla y prueba afectados, y anota si requiere migración. Regenera este manual mediante scripts/build_study_manual.py en el entorno documental indicado en docs/manual/LEEME.md. Los PDF son productos generados; los Markdown y el generador son sus fuentes editables.

Guarda una versión de tu réplica por sesión. Si una mejora rompe una propiedad, vuelve a la última evidencia correcta y reduce el cambio. La habilidad que estás practicando es construir una explicación comprobable del sistema: el documento te orienta, y tus pruebas y razonamientos completan el aprendizaje.
