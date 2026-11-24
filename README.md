# FinTechPro

Proyecto académico de banca digital para DAW II, CIBERTEC. Incluye administración
de usuarios, cuentas, movimientos, préstamos, alertas antifraude y auditoría.

| Módulo | Tecnología | Puerto |
| --- | --- | --- |
| frontend-angular | Angular 21, Material, TypeScript, Nginx | 4200 |
| ms-usuarios | Java 17, Spring Boot 3.2, JWT, BCrypt, SMTP | 8081 |
| ms-cuentas | Spring Boot, JPA, movimientos atómicos | 8082 |
| ms-transacciones | Spring Boot, OpenFeign, antifraude | 8083 |
| ms-prestamos | Spring Boot, OpenFeign, pagos idempotentes | 8084 |
| ms-auditoria | Spring Boot, recepción deduplicada y consulta de eventos | 8085 |
| MySQL | MySQL 8, cinco esquemas, Flyway | 3307 |
| Mailpit | Correo de desarrollo | 8025 |

El navegador usa `/api`; Nginx enruta las peticiones a cada microservicio. Los
servicios propagan identidad y autentican sus llamadas internas. Cada módulo tiene
su propia base de datos. Las transferencias se aplican de forma atómica en cuentas;
los reintentos conservan claves de operación para evitar duplicados. La auditoría
se entrega desde un outbox persistente.

## Arranque rápido

Requiere Docker Desktop en modo Linux y Compose v2. Desde esta carpeta:

```powershell
Copy-Item .env.example .env
# Configurar contraseñas y secretos en .env; no sobrescribir uno existente.
docker compose up -d --build --wait --wait-timeout 240
```

Abrir <http://localhost:4200>. Con el perfil `dev`: `admin@fintech.pe` o
`cliente@fintech.pe`, contraseña `admin123`. La aplicación crea usuarios demo,
pero las cuentas bancarias se abren y activan desde la interfaz.

La recuperación entrega el enlace en el correo capturado en
<http://localhost:8025>. No se envían mensajes a servidores externos en desarrollo.

## Documentación y pruebas

- [Guía de operación, instalación local, contratos y despliegue](docs/OPERACION.md).
- [Reglas de autorización](docs/FASE-0-REGLAS-AUTORIZACION.md).
- [Checklist manual de QA](docs/FASE-11-QA-CHECKLIST.md).
- [Colección Postman actualizada](FinTechPro.postman_collection.json).
- [Prueba de integración reproducible](scripts/smoke_test.py).
- [Pipeline de CI](.github/workflows/verify.yml).

```powershell
mvn -f ms-usuarios/pom.xml verify
mvn -f ms-cuentas/pom.xml verify
mvn -f ms-transacciones/pom.xml verify
mvn -f ms-prestamos/pom.xml verify
mvn -f ms-auditoria/pom.xml verify
cd frontend-angular
npm ci
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

Las pruebas de integración crean datos financieros de demostración. Ejecutarlas
solo en un proyecto Compose y una base desechables, conforme a la guía de operación.
No contienen integraciones con proveedores reales de pagos.

## Equipo

Hugo Alexander Loza Torres, Ketty Grandez Ushiñahua, Ricardo Lucas Ascue
Culquicondor y Frank Keny Aguirre Balcazar. Docente: Ronald Castillo.
# Detalle de préstamos

Cronograma mensual, historial de pagos, vencimientos y cancelación con permisos: [reglas y verificación](docs/PRESTAMOS.md).

## Detalle de transacciones

Revisión previa, recuperación de reintentos, movimientos vinculados y comprobantes PDF: [reglas y verificación](docs/TRANSACCIONES.md).
## Notificaciones personales

Campana con contador, buzón privado, avisos de movimientos y préstamos, vencimientos y lectura individual o masiva: [reglas y verificación](docs/NOTIFICACIONES.md).
## Asistentes de IA

Panel para clientes y administradores con herramientas de consulta autorizadas y orientación de formularios. La configuración actual utiliza Ollama local, sin clave ni cargos de API; OpenAI es opcional. No se incluyen respuestas ficticias si el modelo no está disponible. [Capacidades y permisos](docs/IA.md).
## IA local con Ollama

Los asistentes pueden usar un modelo local sin crédito de API, manteniendo permisos y herramientas de consulta. [Instalación y operación local](docs/OLLAMA.md).

## Auditoria independiente

`ms-auditoria` recibe eventos persistentes de los cuatro productores y sirve la consulta administrativa. [Migración del historial, recuperación, estado y respaldo comprobable](docs/AUDITORIA.md).

## Operación programada

Monitoreo cada cinco minutos y respaldo diario de Auditoría con restauración de prueba. La copia cifrada externa y los avisos por SMTP requieren configurar sus destinos. [Estado, instalación y configuración](docs/OPERACIONES.md).

## Flujos de clientes y administradores

Formularios con confirmación, recuperación ante errores y permisos por rol. [Recorridos revisados, pruebas y límites](docs/FLUJOS.md).

## Manual de estudio y reconstrucción

Cinco tomos con arquitectura, instalación, backend, frontend, IA, operación, sesiones y referencia del código. Los PDF están en `output/pdf/` y sus fuentes editables en [docs/manual](docs/manual/LEEME.md).
