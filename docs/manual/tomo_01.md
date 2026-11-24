# 1. Cómo estudiar y reconstruir FinTechPro

## 1.1 El resultado que debes poder construir

FinTechPro es una aplicación académica de banca digital. Un cliente se registra, inicia sesión, abre cuentas, consulta movimientos, realiza operaciones de demostración y solicita o paga préstamos. Un administrador gestiona perfiles, acceso y cuentas, evalúa solicitudes, atiende alertas y consulta auditoría. Ambos disponen de notificaciones personales y asistencia de IA con permisos limitados.

El propósito del manual es que puedas explicar y reproducir esos recorridos. No basta con conseguir que aparezca la pantalla inicial: debes poder seguir una solicitud desde el navegador hasta su validación, persistencia, respuesta, auditoría y notificación. Usa el código del repositorio como especificación ejecutable y las pruebas como criterios de aceptación.

Hay dos formas de replicar. La primera es reproducir la instalación de la versión actual, conservando sus versiones y archivos de configuración. La segunda es reconstruir su implementación en una carpeta nueva, avanzando por módulos y comparando resultados. El tomo I cubre la primera; los tomos II a V desarrollan la segunda. Es recomendable terminar primero una instalación funcional como referencia.

**Alcance real.** No existe integración con redes bancarias, cajeros, pagos externos, centrales de riesgo o emisión de tarjetas. Los depósitos del ejemplo simulan fondos. La evaluación crediticia utiliza antecedentes internos, no un reporte oficial. La IA orienta y consulta; no transfiere dinero ni aprueba préstamos. Auditoría está separada, pero Alertas permanece dentro de Transacciones.

## 1.2 Requisitos de conocimiento

Antes de modificar el proyecto debes manejar clases, interfaces, excepciones, colecciones y tipos genéricos en Java; promesas, objetos, módulos y tipado en TypeScript; consultas SQL, claves y transacciones; y HTTP con JSON. Si alguno de esos temas es nuevo, reconstruye primero un recurso sencillo de solo lectura y verifica su respuesta antes de implementar dinero.

Una sesión de estudio útil termina con cuatro evidencias: un cambio pequeño que compila, una petición que demuestra su comportamiento, una prueba de rechazo y una explicación escrita del motivo de la solución. Si solo copias clases sin poder justificar sus validaciones, todavía no has completado la sesión.

**Cuaderno personal.** Para cada módulo registra: qué datos posee, qué invariantes protege, qué servicios necesita, qué ocurre si una llamada falla, cómo se reintenta y qué pruebas lo demuestran. Esta ficha se reutiliza en cada laboratorio del tomo V.

## 1.3 Ruta de estudio recomendada

| Etapa | Objetivo | Evidencia mínima |
| --- | --- | --- |
| Fundamentos | Comprender procesos, HTTP y datos | Dibujar el recorrido de una consulta |
| Instalación | Arrancar una copia aislada | Servicios saludables e inicio de sesión |
| Usuarios y Cuentas | Identidad, propiedad y persistencia | Rechazar la consulta de una cuenta ajena |
| Transacciones | Atomicidad y reintentos | Repetir una transferencia sin duplicar fondos |
| Préstamos | Estados, cuotas y pagos | Aprobar, desembolsar y aplicar un pago |
| Frontend | Formularios y resultados inciertos | Recuperar una operación tras perder su respuesta |
| Eventos e IA | Integraciones con límites | Recuperar auditoría y rechazar una herramienta prohibida |
| Verificación | Demostrar consistencia | Ejecutar pruebas y explicar sus límites |

# 2. Arquitectura de la versión documentada

## 2.1 Procesos, responsabilidades y propiedad de datos

Hay cinco aplicaciones Spring Boot independientes. Cada una produce un JAR y tiene su propio pom.xml, aplicación principal, configuración, migraciones y pruebas. No hay un único pom raíz que compile todos los módulos como reactor Maven. Angular es una aplicación independiente; en Docker su compilación estática se sirve mediante Nginx.

:::diagram architecture

| Módulo | Responsabilidad propietaria | Esquema |
| --- | --- | --- |
| ms-usuarios | Identidad, perfiles, recuperación, notificaciones e integración IA | fintech_usuarios |
| ms-cuentas | Cuentas y aplicación atómica de movimientos sobre saldos | fintech_cuentas |
| ms-transacciones | Registro de movimientos, reversión, comprobantes y alertas | fintech_transacciones |
| ms-prestamos | Solicitudes, evaluación interna, cuotas, pagos y vencimientos | fintech_prestamos |
| ms-auditoria | Recepción deduplicada y consulta administrativa de eventos | fintech_auditoria |

Los esquemas están separados lógicamente, pero residen en un único MySQL y Compose utiliza una cuenta de aplicación con acceso a ellos. Esa configuración simplifica el entorno académico; no equivale a independencia física ni a aislamiento fuerte de credenciales. El identificador de usuario de Cuentas referencia un recurso remoto, no una entidad JPA cargada desde Usuarios.

Una frontera de servicio es una frontera de transacción local. La operación que modifica ambos saldos ocurre dentro de Cuentas. Transacciones la solicita por HTTP y registra su propio estado. Un rollback en Transacciones no deshace automáticamente una llamada que ya confirmó Cuentas. Por eso existen claves idempotentes y estados de resultado pendiente.

## 2.2 Conexiones y dependencias de disponibilidad

El navegador accede a /api en su mismo origen cuando usa la compilación de producción. Nginx dirige Usuarios a 8081, Cuentas a 8082, Transacciones y Alertas a 8083, Préstamos a 8084 y Auditoría a 8085. No hay un API Gateway Spring Cloud ni registro de servicios: los nombres DNS son los nombres de Compose.

Las llamadas autenticadas de los servicios financieros validan la vigencia del JWT consultando Usuarios. Esto permite revocar sesiones inmediatamente, pero convierte Usuarios en una dependencia transversal. La caída de Auditoría puede tolerarse con eventos pendientes; la caída de Usuarios o MySQL tiene un alcance mayor. Separa siempre estos casos cuando expliques resiliencia.

Ollama es opcional para las operaciones bancarias. Mailpit captura los correos de recuperación en desarrollo. No es el servicio de notificaciones de la campana: esos avisos se guardan en la base de Usuarios y los consumen las pantallas autenticadas.

## 2.3 Tecnologías y versiones que debes conservar

La fuente de verdad de versiones es pom.xml para Java y package.json más package-lock.json para Angular. No reemplaces automáticamente las dependencias por las últimas versiones durante la reproducción: una actualización de framework es un trabajo distinto y necesita su propia verificación.

| Tecnología | Versión/configuración del repositorio | Función |
| --- | --- | --- |
| Java | 17 | Compilar y ejecutar los servicios |
| Spring Boot | 3.2.5 | Arranque, HTTP, configuración e integración |
| Spring Cloud | 2023.0.1 en servicios con Feign | Clientes HTTP declarativos |
| JJWT | 0.12.5 | Firma y validación de JWT |
| MySQL | Imagen mysql:8.0 | Persistencia InnoDB |
| Angular | Framework 21.2.26; CLI 21.2.30 | Aplicación web standalone |
| Angular Material/CDK | 21.2.14 | Componentes de interfaz |
| TypeScript / RxJS | ~5.9.3 / ~7.8.0 | Tipado y composición asíncrona |
| Node.js | ^20.19.0, ^22.12.0 o >=24 según engines | Herramientas del frontend |
| Ollama | Imagen 0.40.16 en el override | Inferencia del modelo local |
| Python | Se utilizó 3.11 | Pruebas de integración y operación |

Las etiquetas de contenedor y rangos con ~ no fijan todos los bytes futuros. Para reconstrucción exacta conserva el lock de npm, el repositorio y un registro de versiones de herramientas; para una distribución reproducible de contenedores registra también sus digest. El manual no declara que las etiquetas equivalgan a imágenes inmutables.

# 3. Preparación del equipo y del repositorio

## 3.1 Comprobaciones antes del arranque

Instala Docker Desktop con contenedores Linux y Compose v2. Para estudiar el código fuera de contenedores instala JDK 17, Maven, Node compatible, npm, Python y Chrome. Docker puede construir las imágenes aunque no tengas Maven y Node locales, porque los Dockerfile incluyen sus etapas de construcción. Las herramientas locales son necesarias para ejecutar las pruebas y depurar sin reconstruir cada imagen.

```powershell
docker version
docker compose version
java -version
mvn -v
node --version
npm --version
python --version
```

Ejecuta los comandos desde una terminal nueva después de cambiar PATH o JAVA_HOME. Si mvn informa una versión de Java distinta a java -version, revisa JAVA_HOME. Las rutas absolutas del equipo original no son requisitos del proyecto: ajusta las de tu instalación.

Reserva espacio para imágenes, volumen MySQL, paquetes npm y modelo de IA. Mover el disco global de Docker afecta otros proyectos y es una operación administrativa distinta; para reproducir esta aplicación no debes copiar a ciegas la unión o la ruta D:/DockerData del equipo original. La GPU solo es necesaria si decides activar el override de GPU.

## 3.2 Ubicar la raíz correcta

La carpeta de trabajo debe contener docker-compose.yml, init-db.sql, los cinco módulos Java, frontend-angular y scripts. Un error frecuente es ejecutar Compose desde la carpeta superior o Maven desde el módulo equivocado. Usa Get-Location y Get-ChildItem para comprobarlo.

```text
raiz-del-proyecto/
  docker-compose.yml
  docker-compose.ollama.yml
  docker-compose.ollama.gpu.yml
  init-db.sql
  .env.example
  ms-usuarios/      ms-cuentas/       ms-transacciones/
  ms-prestamos/     ms-auditoria/
  frontend-angular/
  scripts/         docs/
```

Excluye node_modules, target, dist, .angular, respaldos y .verification cuando leas el código propio. Las bibliotecas descargadas, como RequestContextHolder dentro de spring-web, sirven de referencia del framework: no son clases del proyecto que debas modificar para implementar un flujo.

## 3.3 Preparar las variables sin exponer secretos

Copia .env.example solo cuando no exista .env. El archivo real del equipo puede contener credenciales y nunca debe incorporarse al manual, al frontend, a Git o a una captura. El ejemplo contiene marcadores que debes sustituir. JWT_SECRET e INTERNAL_SERVICE_KEY cumplen funciones diferentes y deben tener valores distintos.

```powershell
if (!(Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
# Edita .env localmente. Conserva valores propios y aleatorios.
```

JWT_SECRET debe contener material suficiente para la firma HMAC; el proyecto exige al menos 32 bytes efectivos. La longitud en caracteres no siempre equivale a bytes UTF-8. MYSQL_ROOT_PASSWORD administra MySQL; MYSQL_PASSWORD es la contraseña de la cuenta de aplicación. No uses root como usuario cotidiano del servicio si estás siguiendo Compose.

AI_PROVIDER=ollama no inicia por sí solo un contenedor: necesitas el archivo de override de Ollama o un servicio local ya iniciado. Para una primera instalación sin IA puedes establecer AI_ENABLED=false y probar primero los flujos principales.

# 4. Arranque reproducible en Docker

## 4.1 Instalación estándar nueva

En una copia nueva y sin conflictos de puertos, el siguiente comando construye el sistema base. Flyway crea las tablas en los esquemas que init-db.sql prepara al inicializar un volumen MySQL nuevo.

```powershell
docker compose up -d --build --wait --wait-timeout 240
docker compose ps
```

La interfaz estándar está en http://localhost:4200; MySQL se publica en 3307 y Mailpit en http://localhost:8025. Los cinco backend usan 8081 a 8085. En perfil dev se crean admin@fintech.pe y cliente@fintech.pe con contraseña de demostración admin123. Estas credenciales son públicas de desarrollo y nunca deben acompañar datos reales ni un despliegue accesible a terceros.

Un healthcheck saludable prueba la condición definida por el servicio, no todos sus recorridos de negocio. Después del arranque inicia sesión, abre una cuenta de cliente y actívala como administrador antes de intentar movimientos. No se deben inventar cuentas ni identificadores fijos a partir de ejemplos del manual.

## 4.2 Entorno aislado para estudiar sin tocar la instalación actual

El equipo de trabajo ya utilizó fintech-verificacion en 4300, con backend 8181 a 8185, MySQL 3407 y Mailpit 8125. Para tus ejercicios se propone un tercer proyecto, fintech-estudio, con los puertos siguientes. Este es un perfil de laboratorio propuesto; los resultados históricos documentados corresponden a fintech-verificacion.

```powershell
$env:MYSQL_PORT='3507'
$env:FRONTEND_PORT='4400'
$env:PORT_8081='8281'
$env:PORT_8082='8282'
$env:PORT_8083='8283'
$env:PORT_8084='8284'
$env:PORT_8085='8285'
$env:MAIL_UI_PORT='8225'
$env:PASSWORD_RESET_FRONTEND_URL='http://localhost:4400/reset-password'
$env:AI_ENABLED='false'
docker compose -p fintech-estudio up -d --build --wait --wait-timeout 240
```

El nombre de proyecto separa recursos de Compose, incluidos los volúmenes nombrados, pero no evita conflictos de puertos publicados. Por eso necesitas ambas cosas: otro nombre y otros puertos. Las variables de esa terminal prevalecen sobre el archivo .env al interpolar Compose. Conserva la misma terminal o vuelve a configurarlas antes de recrear contenedores.

## 4.3 Qué ocurre con un volumen existente

init-db.sql solo se ejecuta al inicializar el directorio de datos vacío. Editarlo no crea automáticamente fintech_auditoria en un volumen usado. Para una instalación histórica se utiliza el procedimiento de docs/AUDITORIA.md y scripts/migrate_audit.py, primero preparando el esquema y luego importando el archivo anterior con verificación.

```powershell
python scripts/migrate_audit.py --project fintech-estudio --prepare
# Arranca ms-auditoria y espera a que Flyway cree sus tablas.
python scripts/migrate_audit.py --project fintech-estudio --copy
```

No ejecutes el ejemplo de migración sobre cualquier base por intuición. Comprueba proyecto, respaldo y estado inicial. En una instalación nueva no necesitas importar auditoría histórica. flyway_schema_history debe pertenecer a cada esquema y reflejar las versiones de su módulo.

## 4.4 Diagnóstico de arranque

```powershell
docker compose -p fintech-estudio ps -a
docker compose -p fintech-estudio logs --tail 80 ms-usuarios
docker compose -p fintech-estudio logs --tail 80 ms-cuentas
docker compose -p fintech-estudio logs --tail 80 ms-auditoria
```

Si Docker no responde, inicia Docker Desktop antes de investigar Java. Si MySQL falla por autenticación tras cambiar .env, recuerda que cambiar una variable no cambia la contraseña almacenada en un volumen existente. Si Flyway detecta un checksum distinto, restaura el archivo de migración original y crea una migración nueva para evolucionar el esquema.

Una respuesta 502 desde Nginx puede indicar un backend aún no disponible. Una respuesta 401 no significa necesariamente contraseña incorrecta: también puede ser sesión revocada o imposibilidad de validar la identidad. Una página funciona por navegación interna pero falla al recargar si no existe el fallback a index.html del proxy.

# 5. Desarrollo local y configuración efectiva

## 5.1 Compilar y probar cada servicio

Cada módulo se ejecuta y verifica por separado. Primero descarga dependencias con acceso a sus repositorios; el modo offline de Maven solo es útil después de poblar el repositorio local. Si el IDE muestra errores Lombok pero Maven compila, revisa el soporte del IDE y el procesamiento de anotaciones.

```powershell
mvn -f ms-usuarios/pom.xml verify
mvn -f ms-cuentas/pom.xml verify
mvn -f ms-transacciones/pom.xml verify
mvn -f ms-prestamos/pom.xml verify
mvn -f ms-auditoria/pom.xml verify
```

Para ejecutar servicios con Spring Boot fuera de Docker debes exportar sus variables en el proceso Java. El archivo .env no se carga automáticamente por Spring ni por npm. Los application.properties de varios servicios apuntan por defecto a localhost:3306 y root; no coinciden con el puerto 3507 de tu laboratorio. Sobrescribe SPRING_DATASOURCE_URL, USERNAME y PASSWORD de forma explícita.

El siguiente patrón corresponde solo a Usuarios y a los puertos internos estándar de aplicaciones locales. No ejecutes al mismo tiempo un backend local y un contenedor que publique su mismo puerto. Para otros servicios cambia el esquema y sus URLs de dependencias.

```powershell
$env:SPRING_DATASOURCE_URL='jdbc:mysql://localhost:3507/fintech_usuarios?serverTimezone=UTC'
$env:SPRING_DATASOURCE_USERNAME='fintech_user'
# Define SPRING_DATASOURCE_PASSWORD, JWT_SECRET e INTERNAL_SERVICE_KEY localmente.
$env:SMTP_HOST='localhost'
# Mailpit debe publicar su puerto SMTP si el backend corre fuera de Docker.
mvn -f ms-usuarios/pom.xml spring-boot:run
```

Compose publica la interfaz web de Mailpit, pero no su puerto SMTP 1025 en el host. Un backend local no puede asumir que localhost:1025 existe. Configura un override de laboratorio que publique ese puerto o mantén Usuarios dentro de Docker. Esta distinción evita diagnosticar como error de recuperación un problema de red del entorno.

## 5.2 Desarrollo de Angular

```powershell
Set-Location frontend-angular
npm ci
npm run build
$env:CHROME_BIN='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm test -- --watch=false --browsers=ChromeHeadless
npm start -- --port 4500
```

El environment de desarrollo contiene URLs absolutas a 8081-8085. El de producción usa /api y depende de Nginx. El archivo proxy.conf.json está disponible, pero añadir --proxy-config no redirige una URL absoluta que el navegador ya envía a otro puerto. Para usar el proxy de desarrollo debes ajustar el environment a rutas relativas en tu copia de estudio; para usar los backend del laboratorio debes adaptar sus puertos 8281-8285.

No pongas claves del proveedor IA, contraseñas MySQL o la clave interna en environment.ts. Ese archivo se compila y llega al navegador. La configuración pública de una aplicación web puede contener URLs; los secretos se quedan en el backend.

## 5.3 Autoevaluación resuelta

**Pregunta:** si Cuentas corre en Docker, ¿localhost apunta a Usuarios? **Respuesta:** no. Desde ese contenedor localhost es Cuentas. El nombre ms-usuarios resuelve al contenedor de Usuarios en la red de Compose.

**Pregunta:** ¿por qué cuatro JAR sanos no garantizan que Auditoría funcione? **Respuesta:** Auditoría es un quinto proceso con esquema y configuración propios. Además, salud del proceso no prueba la entrega de todas las colas.

**Pregunta:** ¿puedes copiar tu .env a Angular para simplificar el acceso? **Respuesta:** no. La aplicación cliente se distribuye al usuario. Los secretos de base de datos, firma y llamadas internas no pertenecen a su paquete.

**Criterio de cierre del tomo:** reproduce un inicio de sesión y dibuja las cinco fronteras de datos sin consultar el diagrama. Después explica por qué una transferencia necesita coordinación entre servicios pero sus dos saldos se modifican juntos en Cuentas.
