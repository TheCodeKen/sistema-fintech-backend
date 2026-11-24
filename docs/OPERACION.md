# FinTechPro: operación y verificación

## Requisitos

Docker Desktop con contenedores Linux y Docker Compose v2. Para desarrollar sin
Docker: Java 17, Maven 3.9, Node 20.19+, npm y MySQL 8. Chrome permite ejecutar Karma.

## Arranque desde una copia limpia

Desde la carpeta que contiene `docker-compose.yml`:

```powershell
Copy-Item .env.example .env
# Editar .env: contraseñas y dos secretos diferentes y aleatorios.
docker compose up -d --build --wait --wait-timeout 240
```

No sobrescribir un `.env` existente. `MYSQL_USER` debe ser `fintech_user`, conforme
a los permisos del script `init-db.sql`. El secreto JWT debe tener al menos 32
bytes. No subir `.env` al repositorio.

Frontend: <http://localhost:4200>. Correo de desarrollo: <http://localhost:8025>.
Mailpit captura los mensajes localmente; no los entrega a destinatarios externos.
MySQL se publica en 3307; las APIs en 8081–8084. Los puertos son configurables.

Compose construye Angular y Java desde fuente. Los healthchecks comprueban conexión
con la base; el frontend espera a los cuatro backends. Todas las llamadas del
navegador pasan por `/api` en Nginx; los nombres de contenedores nunca se usan como
URLs del navegador.

El perfil `dev` crea `admin@fintech.pe` y `cliente@fintech.pe`, contraseña
`admin123`. Es exclusivo de demostración. No se crean cuentas bancarias precargadas:
abrir una cuenta desde la aplicación y activarla con el administrador.

## Base de datos y actualizaciones

`init-db.sql` crea las cuatro bases y permisos únicamente al inicializar un volumen
vacío. Flyway ejecuta las migraciones `src/main/resources/db/migration` de cada
microservicio. Hibernate valida el esquema y no lo modifica.

V1 define el esquema inicial. Una base existente sin historial Flyway se registra
en V1; V2 incorpora columnas y tablas nuevas sin borrar datos. Respaldar la base
antes de actualizar y probar la actualización sobre una copia. No editar una
migración aplicada: crear una nueva versión.

`docker compose down` conserva el volumen. No usar `down -v` para una actualización:
elimina la base. La aplicación hace bajas lógicas para conservar historial.

## Desarrollo sin Docker

Crear las bases con `init-db.sql` usando un administrador MySQL. Definir
`JWT_SECRET`, `INTERNAL_SERVICE_KEY` y `DB_PASSWORD` en todas las terminales. Los
servicios usan `root` por defecto en ejecución local; se puede sobrescribir con
`SPRING_DATASOURCE_USERNAME`. Para datos demo definir `SPRING_PROFILES_ACTIVE=dev`
en usuarios. Configurar SMTP mediante `SMTP_HOST` y `SMTP_PORT`.

```powershell
mvn -f ms-usuarios/pom.xml spring-boot:run
mvn -f ms-cuentas/pom.xml spring-boot:run
mvn -f ms-transacciones/pom.xml spring-boot:run
mvn -f ms-prestamos/pom.xml spring-boot:run
```

Cada comando requiere una terminal. Después:

```powershell
cd frontend-angular
npm ci
npm start
```

El servidor Angular usa `proxy.conf.json` para `/api`. Las URLs de Feign pueden
sobrescribirse con `SERVICES_USUARIOS_URL`, `SERVICES_CUENTAS_URL`,
`SERVICES_TRANSACCIONES_URL` y `SERVICES_PRESTAMOS_URL`.

## Contratos financieros

- Los clientes solo operan sus recursos; el backend valida el propietario del JWT.
- Un cliente abre cuentas con saldo cero. Los administradores pueden registrar un
  saldo inicial de demostración. Los depósitos son operaciones simuladas, sin
  integración con un proveedor de pagos o una caja real.
- Los movimientos admiten PEN y USD, sin conversión. La moneda del préstamo debe
  coincidir con la cuenta.
- La tasa de clientes es 18% anual. Se utiliza una cuota fija calculada con fórmula
  de anualidad; deuda inicial = cuota redondeada × número de meses. Los pagos
  reducen esa deuda total, incluidos los intereses pactados. No se implementan
  penalidades, mora diaria ni descuentos por prepago. El vencimiento comienza en
  la fecha de desembolso. Este contrato es académico y debe adaptarse antes de uso
  financiero real.
- Una transferencia se aplica en una sola transacción MySQL, bloqueando las dos
  cuentas en orden estable. Si falla una validación, no se cambia ningún saldo.
- `POST /api/transacciones` exige `Idempotency-Key` (8–64 caracteres alfanuméricos,
  guiones o `_`). Reutilizarla solo con el mismo cuerpo. La clave queda separada
  por usuario y por llamadas internas.
- Un timeout puede dejar una operación `PROCESANDO`: repetir la misma petición y
  clave consulta/reaplica el mismo movimiento sin duplicarlo. No sustituir la clave
  mientras el resultado sea incierto. Se conserva un registro persistente en
  cuentas y otro en transacciones.
- El desembolso de un préstamo tiene una clave determinista. Los pagos incluyen
  `operacionId` en el JSON; al reintentar debe conservarse esa clave.
- Desembolsos y pagos de préstamos solo se crean por el workflow interno. Las
  reversiones independientes de esos movimientos están prohibidas para no separar
  saldo y deuda. Tampoco se revierte otra reversión.
- `PUT /api/cuentas/{id}/saldo` está retirado. El ajuste interno autorizado utiliza
  `POST /api/cuentas/internal/movimientos` y nunca se expone como formulario.
- Una cuenta se cierra con saldo cero y sin préstamos pendientes. No se elimina
  físicamente. Los usuarios también se desactivan en lugar de borrar su historial.

## Identidad, correo y auditoría

La desactivación, los cambios administrativos y el restablecimiento de contraseña
incrementan la versión de sesión. Cada backend valida el JWT contra usuarios:
una sesión revocada deja de funcionar en los cuatro servicios. Si identidad no
está disponible, el acceso falla de forma cerrada, con timeouts acotados.

Recuperación pública: `POST /api/usuarios/password/forgot`, JSON `{ "email": "..." }`.
El enlace se entrega solo por SMTP. Restablecimiento:
`POST /api/usuarios/password/reset`, JSON `{ "token": "...", "nuevaPassword": "..." }`.
El token caduca y es de un solo uso; ni el enlace ni el JWT se imprimen en logs.

Las auditorías de cuentas, préstamos y transacciones se guardan en un outbox
transaccional y se entregan en segundo plano a usuarios, con identificador único.
Un fallo temporal conserva el evento para reintento. No se guardan JWT en el
outbox. `X-Internal-Service` se valida exclusivamente en el backend y debe
permanecer privado.

## Verificación automatizada

```powershell
mvn -f ms-usuarios/pom.xml verify
mvn -f ms-cuentas/pom.xml verify
mvn -f ms-transacciones/pom.xml verify
mvn -f ms-prestamos/pom.xml verify
cd frontend-angular
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

El pipeline `.github/workflows/verify.yml` ejecuta backend, frontend y la prueba
de integración. La prueba `scripts/smoke_test.py` crea usuarios y movimientos de
demostración: ejecutarla únicamente contra una base desechable, nunca producción.

Para un entorno separado, utilizar otro proyecto Compose y puertos:

```powershell
$env:MYSQL_PORT='3407'
$env:PORT_8081='8181'; $env:PORT_8082='8182'
$env:PORT_8083='8183'; $env:PORT_8084='8184'
$env:FRONTEND_PORT='4300'; $env:MAIL_UI_PORT='8125'
$env:PASSWORD_RESET_FRONTEND_URL='http://localhost:4300/reset-password'
docker compose -p fintech-verificacion up -d --build --wait --wait-timeout 240
python scripts/smoke_test.py --url http://localhost:4300 --mail http://localhost:8125
```

Para detener solo ese entorno: `docker compose -p fintech-verificacion down`.
Los puertos deben mantenerse en el entorno de la terminal al administrar Compose.

## Despliegue fuera de desarrollo

Configurar `SPRING_PROFILES_ACTIVE=prod`. Para la primera instalación definir
`BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` (12–72 caracteres). No se crean
las credenciales demo en ese perfil. Después del primer arranque, retirar la
contraseña de bootstrap del entorno.

Configurar un servidor SMTP real con sus credenciales/TLS y una URL HTTPS pública
en `PASSWORD_RESET_FRONTEND_URL`. El Compose incluido usa Mailpit para desarrollo;
sobrescribir la configuración SMTP de `ms-usuarios` mediante un override para
producción. Configurar terminación TLS y acceso restringido a MySQL y a los puertos
internos. Mantener copias de seguridad y monitorizar operaciones `PROCESANDO` y
eventos pendientes. No se ha integrado un proveedor de pagos real.
