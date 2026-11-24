# Asistentes locales con Ollama

El proyecto admite `AI_PROVIDER=ollama` para procesar las conversaciones con un modelo local, sin claves ni cargos de API. OpenAI se conserva como integración opcional. Los dos modos del asistente mantienen las mismas herramientas de consulta y permisos del backend.

## Configuración local

En `.env`:

```dotenv
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=qwen3:4b-instruct-2507-q4_K_M
```

No es necesario borrar otras configuraciones de `.env`: el modo local ignora la clave y el modelo de OpenAI. El archivo de Compose de Ollama vacía expresamente la clave en el contenedor de usuarios. `.env.example` nunca debe contener claves reales.

## Arranque con Docker y GPU NVIDIA

Los archivos adicionales no modifican los volúmenes de MySQL. El modelo se guarda en el volumen independiente `ollama_data` del proyecto Compose.

En el entorno aislado de verificación, conservar sus puertos:

```powershell
$env:MYSQL_PORT='3407'
$env:PORT_8081='8181'; $env:PORT_8082='8182'
$env:PORT_8083='8183'; $env:PORT_8084='8184'
$env:FRONTEND_PORT='4300'; $env:MAIL_UI_PORT='8125'
$env:PASSWORD_RESET_FRONTEND_URL='http://localhost:4300/reset-password'
```

Después:

```powershell
docker compose -p fintech-verificacion -f docker-compose.yml -f docker-compose.ollama.yml -f docker-compose.ollama.gpu.yml up -d --wait ollama
docker compose -p fintech-verificacion -f docker-compose.yml -f docker-compose.ollama.yml -f docker-compose.ollama.gpu.yml exec -T ollama ollama pull qwen3:4b-instruct-2507-q4_K_M
docker compose -p fintech-verificacion -f docker-compose.yml -f docker-compose.ollama.yml -f docker-compose.ollama.gpu.yml up -d --build --wait ms-usuarios frontend-angular
```

Para un equipo sin GPU compatible, omitir `-f docker-compose.ollama.gpu.yml`. El modelo puede responder más lentamente en CPU y alcanzar los límites de tiempo del asistente. El equipo de esta revisión cuenta con RTX 4060 de 8 GB y aproximadamente 16 GB de RAM.

La descarga inicial requiere conexión y varios GB libres para la imagen de Docker y el modelo. Después, la inferencia local no necesita crédito de ningún proveedor. No confundir el espacio libre del proyecto con el espacio del disco donde Docker almacena sus imágenes y volúmenes.

## Aislamiento y compatibilidad

- Imagen fijada a `ollama/ollama:0.40.16` y modelo `qwen3:4b-instruct-2507-q4_K_M`, de unos 2,5 GB y con soporte para herramientas.
- Se comprobó esta variante Instruct expresamente. La etiqueta `qwen3:4b` probada fuerza razonamiento y produjo respuestas incompletas o tiempos excesivos; no es intercambiable con la variante configurada.
- `OLLAMA_NO_CLOUD=1` desactiva las funciones cloud de Ollama. El backend también rechaza endpoints externos y modelos con `cloud` en el nombre en modo local.
- El puerto 11434 se publica solo en `127.0.0.1`; los servicios acceden por la red interna de Docker.
- Se usa `/v1/responses` en modo stateless. Se omiten campos exclusivos de OpenAI, las peticiones no llevan la clave de OpenAI y se desactiva el pensamiento del modelo para reducir la espera.
- El contexto está configurado en 16384 tokens, con una ejecución paralela y caché KV `q8_0`, para limitar la memoria necesaria.
- El estado del asistente comprueba que Ollama responda y que el modelo seleccionado esté descargado. Si no está disponible, la interfaz muestra una indicación específica.
- El panel informa del procesamiento local. Las herramientas siguen enviando a las APIs del proyecto el JWT del usuario; no se amplían los permisos por cambiar el motor de IA.
- No hay fallback automático a proveedores externos. Si Ollama falla, se muestra el error sin cobrar otra API ni inventar una respuesta.

## Comprobaciones

```powershell
docker compose -p fintech-verificacion -f docker-compose.yml -f docker-compose.ollama.yml -f docker-compose.ollama.gpu.yml exec -T ollama ollama list
docker compose -p fintech-verificacion -f docker-compose.yml -f docker-compose.ollama.yml -f docker-compose.ollama.gpu.yml exec -T ollama ollama ps
python scripts/ollama_smoke_test.py --url http://localhost:4300
```

El script crea usuarios, cuentas y fondos de demostración: usar exclusivamente un entorno desechable. Comprueba respuestas del modelo local real, fuentes, permisos y ausencia de movimientos de dinero por parte de la IA. La calidad del texto puede variar entre preguntas; los datos y decisiones siempre deben comprobarse en los detalles de la aplicación.

Las pruebas unitarias cubren el funcionamiento sin clave, la ausencia de credenciales en peticiones locales, el rechazo de endpoints externos/modelos cloud y la disponibilidad según el modelo descargado. Se conservan las pruebas de permisos, privacidad y límites del asistente.

La verificación con el modelo real aprobó nueve comprobaciones. Las cuatro consultas de generación tardaron entre 1,1 y 6 segundos con el modelo cargado en la GPU; no es una garantía de rendimiento en otros equipos. El arranque en frío puede tardar más. El modelo tiene 4 mil millones de parámetros: puede interpretar mal una muestra o generar afirmaciones sin respaldo. Los enlaces a registros son la referencia para comprobar su respuesta; no se deben usar sus resúmenes para decisiones automáticas.

## Almacenamiento de Docker en este equipo

Durante la instalación, C: se quedó sin espacio y Docker dejó de responder. El usuario autorizó trasladar su disco de datos, de unos 50 GB, a `D:\DockerData`. El procedimiento conserva todos los contenedores y volúmenes, compara SHA-256 antes de retirar el original y mantiene la ruta anterior mediante una unión de directorios:

```text
C:\Users\Usuario\AppData\Local\Docker\wsl\disk
  -> D:\DockerData\disk
```

No borrar esa unión ni el archivo `docker_data.vhdx` de destino. No se debe volver a ejecutar el procedimiento de traslado sobre un disco ya trasladado. Las bases siguen dentro del mismo disco virtual; no se crean bases vacías para sustituirlas.

Fuentes: [Docker con Ollama](https://docs.ollama.com/docker), [compatibilidad Responses](https://docs.ollama.com/api/openai-compatibility), [desactivar cloud](https://docs.ollama.com/faq#how-do-i-disable-ollamas-cloud-features) y [modelo Qwen3 4B](https://ollama.com/library/qwen3:4b-instruct-2507-q4_K_M).
