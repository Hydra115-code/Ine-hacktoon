# INE Explora — Backend

API y servidor MCP para consultas de participación electoral. El servicio interpreta preguntas, consulta datos CCPC agregados, valida la evidencia y transmite texto, datos e interfaces declarativas al frontend.

## Instalación local paso a paso

Esta guía está pensada para Linux, macOS o WSL. El backend puede arrancar de dos formas:

- **Prueba rápida:** reglas locales, SQLite y una muestra de datos incluida. No requiere cuenta, suscripción ni clave de IA.
- **Producto completo:** dataset CCPC 1.0.0 y, opcionalmente, Gemini para comprender preguntas abiertas.

### 1. Instalar los requisitos

- [Git](https://git-scm.com/downloads).
- [Node.js 22.18 LTS](https://nodejs.org/) o superior. El backend admite Node 22, pero el release completo de Datos requiere 22.18 o posterior.
- Acceso al repositorio de GitHub.

Comprueba la instalación en una terminal:

```bash
git --version
node --version
corepack --version
```

Si `corepack` no existe, instálalo y vuelve a comprobarlo:

```bash
npm install --global corepack
corepack --version
```

### 2. Descargar la rama del backend

Desde la carpeta donde quieras guardar el proyecto:

```bash
mkdir -p INE-Integracion
cd INE-Integracion
git clone --branch Back-end --single-branch git@github.com:Hydra115-code/Ine-hacktoon.git back-end
cd back-end
```

Si Git muestra `Permission denied (publickey)`, configura una llave SSH en GitHub o, si tu cuenta tiene acceso, usa la URL HTTPS:

```bash
git clone --branch Back-end --single-branch https://github.com/Hydra115-code/Ine-hacktoon.git back-end
cd back-end
```

Si ya descargaste esta rama, no vuelvas a clonarla: entra a `back-end/` y continúa.

### 3. Instalar la versión correcta de pnpm y las dependencias

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm --version
pnpm install --frozen-lockfile
```

El resultado de `pnpm --version` debe ser `10.34.5`. No uses `npm install`: el proyecto fija sus dependencias con `pnpm-lock.yaml`.

### 4. Crear la configuración local

```bash
cp .env.example .env
```

Genera un token local:

```bash
openssl rand -hex 32
```

Copia el resultado. Abre `.env` en un editor y deja, como mínimo:

```dotenv
AUTH_MODE=local_sqlite
SQLITE_DATABASE_PATH=.local/ine-explora.sqlite
LOCAL_ACTOR_ID=10000000-0000-4000-8000-000000000001
UI_PLANNER_MODE=rules
AGENT_API_HOST=127.0.0.1
AGENT_API_PORT=3101
AGENT_API_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
AGENT_API_TOKEN=pega-aqui-el-token-generado
```

El token debe tener al menos 32 caracteres. Guarda el mismo valor en `front-end/.env.local`; si no coincide, el frontend recibirá un error `401`.

No borres las demás variables del archivo: pueden conservar sus valores de ejemplo mientras la función correspondiente esté desactivada. Nunca subas `.env` a Git.

### 5. Elegir la fuente de datos

#### Opción A — Muestra incluida

Para comprobar rápidamente que el sistema funciona, deja estas variables vacías:

```dotenv
CCPC_DATA_DIR=
CCPC_DATASET_PATH=
```

La API marcará las respuestas como datos de muestra. Esta opción sirve para desarrollo, no para demostrar la cobertura completa del producto.

#### Opción B — Dataset CCPC completo recomendado

La rama `Data` distribuye el módulo completo dentro de un ZIP verificado. Desde `INE-Integracion/`, en otra terminal:

```bash
git clone --branch Data --single-branch git@github.com:Hydra115-code/Ine-hacktoon.git data
cd data
sha256sum -c Entrega-final-CCPC-1.0.0.zip.sha256
unzip Entrega-final-CCPC-1.0.0.zip -d ../data-release
cd ../data-release/Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06
npm ci --ignore-scripts
```

En macOS, sustituye la línea de `sha256sum` por esta línea antes de descomprimir:

```bash
shasum -a 256 -c Entrega-final-CCPC-1.0.0.zip.sha256
```

Después configura `back-end/.env` con estas rutas. Son relativas a la carpeta `back-end/`:

```dotenv
CCPC_DATA_DIR=../data-release/Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06
CCPC_DATASET_PATH=data/ccpc/full/participation.compact.json
```

No edites ni reformatees los archivos del release: el backend valida su integridad antes de aceptar consultas.

La estructura recomendada queda así:

```text
INE-Integracion/
├── back-end/
├── front-end/
├── data/
└── data-release/
    └── Entrega-final-CCPC-1.0.0/
        └── Ine-hacktoon-DATA-06/
```

### 6. Elegir cómo se interpretan las preguntas

Sin servicios externos:

```dotenv
UI_PLANNER_MODE=rules
```

Con Gemini para preguntas abiertas:

```dotenv
UI_PLANNER_MODE=gemini
GEMINI_API_KEY=pega-aqui-tu-clave
GEMINI_MODEL=gemini-3.7-flash
```

No agregues comillas extra ni espacios alrededor de la clave. Gemini es opcional: si sólo necesitas comprobar instalación y datos, empieza con `rules`.

En modo `gemini`, Gemini interpreta la pregunta, redacta la respuesta y entiende ediciones de la vista ("dámelo en formato gráfica"). La interfaz siempre la arma el backend con los datos, y las cifras se verifican antes de mostrarse. Si Gemini no responde a tiempo, el planificador por reglas contesta en su lugar.

### 7. Iniciar la API

Desde `back-end/`:

```bash
pnpm api
```

El proceso correcto muestra que la API escucha en `http://127.0.0.1:3101`. Mantén la terminal abierta; para detenerla, presiona `Ctrl+C`.

### 8. Comprobar el estado

En otra terminal:

```bash
curl -sS http://127.0.0.1:3101/api/system/status
```

Debes recibir JSON y no una página HTML. Revisa que el estado sea saludable y que la fuente indicada corresponda a muestra o al release CCPC que elegiste.

Después configura e inicia el frontend siguiendo su `README.md`.

### Lista de comprobación

- `pnpm api` permanece en ejecución sin terminar con error.
- `curl http://127.0.0.1:3101/api/system/status` devuelve JSON.
- Backend y frontend usan exactamente el mismo `AGENT_API_TOKEN`.
- El frontend apunta a `http://127.0.0.1:3101/api/agent`.
- Si instalaste el release completo, el estado no lo identifica como muestra.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `AUTH_MODE` | `local_sqlite` o `supabase`. |
| `SQLITE_DATABASE_PATH` | Archivo local para sesiones y snapshots. |
| `CCPC_DATA_DIR` | Carpeta del motor CCPC. Vacía utiliza la muestra incluida. |
| `CCPC_DATASET_PATH` | Archivo dentro de `CCPC_DATA_DIR`. |
| `UI_PLANNER_MODE` | `rules`, `local-model` o `gemini`. |
| `LOCAL_MODEL_URL` | Servidor local compatible con OpenAI. |
| `LOCAL_MODEL_NAME` | Identificador del modelo local. |
| `GEMINI_API_KEY` | Clave requerida únicamente en modo `gemini`. |
| `GEMINI_MODEL` | Modelo usado por Gemini. |
| `GEMINI_PLANNER_TIMEOUT_MS` | Tiempo máximo para que Gemini planee; después responden las reglas (8000). |
| `GEMINI_ANSWER_TIMEOUT_MS` | Tiempo máximo para que Gemini redacte; después se usa la respuesta verificada (3000). |
| `GEMINI_EDIT_TIMEOUT_MS` | Tiempo máximo para que Gemini interprete una edición de la vista (4000). |
| `SESSION_RESET_ON_START` | Con `local_sqlite`, borra las sesiones guardadas al iniciar la API (`true`). |
| `AGENT_API_TOKEN` | Token compartido con el frontend. |
| `AGENT_API_ALLOWED_ORIGINS` | Orígenes permitidos separados por comas. |
| `ELEVENLABS_API_KEY` | Habilita transcripción en tiempo real. |
| `SUPABASE_URL` | Proyecto utilizado en modo `supabase`. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase. |

Consulta `.env.example` para límites, timeouts y variables adicionales. Las claves de Gemini, ElevenLabs y Supabase sólo son necesarias al habilitar esas integraciones.

## Otras formas de ejecución

Servidor MCP por `stdio`, útil para desarrollo de herramientas:

```bash
pnpm dev
```

Build y ejecución compilada:

```bash
pnpm build
pnpm api:start
```

## Planificadores

| Modo | Dependencia externa | Comportamiento |
|---|---:|---|
| `rules` | No | Extrae intención y filtros mediante reglas deterministas. |
| `local-model` | Modelo local | Usa un endpoint compatible con OpenAI y vuelve a reglas si la respuesta es inválida. |
| `gemini` | Google Gemini | Interpreta preguntas abiertas y selecciona herramientas. |

El plan se valida con Zod antes de ejecutar herramientas. Si faltan filtros necesarios, la API solicita contexto y no genera conclusiones.

## Arquitectura

```text
POST /api/agent
  ├─ autenticación, CORS y rate limit
  ├─ política de alcance cívico
  ├─ planificador
  ├─ cliente MCP
  │    └─ herramientas cívicas
  │         └─ CivicDataSource
  │              ├─ motor CCPC externo
  │              └─ muestra incluida
  ├─ validación de razonamiento
  ├─ composición y validación de UI
  ├─ sesión y snapshot
  └─ stream NDJSON
```

## Herramientas MCP

| Herramienta | Resultado |
|---|---|
| `get_participation_summary` | Totales e indicadores de un territorio y una elección. |
| `compare_elections` | Comparación temporal y diferencia en puntos porcentuales. |
| `get_participation_breakdown` | Desglose por entidad, sexo, edad o tipo de sección. |
| `get_supporting_records` | Registros que respaldan una cifra. |

Recursos: `civic://metric-definitions` y `civic://coverage`.

## Endpoints HTTP

| Método | Ruta | Autenticación | Descripción |
|---|---|---:|---|
| `GET` | `/api/system/status` | No | Salud, fuente activa y planificador. |
| `POST` | `/api/agent` | Sí | Pregunta, edición o evento de UI; responde con NDJSON. |
| `POST` | `/api/agent/snapshot` | Sí | Recupera la última vista válida. |
| `POST` | `/api/transcription/realtime-session` | Sí | Crea una sesión efímera de voz. |

El stream puede contener progreso, texto, llamadas de herramientas, registros, especificación de UI, patches, estado y errores recuperables.

## Datos

La fuente implementa `CivicDataSource` en `src/application/ports/civic-data.ts`.

- Sin `CCPC_DATA_DIR`: utiliza la muestra en `src/fixtures` y marca la respuesta como muestra.
- Con `CCPC_DATA_DIR`: carga el dataset compacto CCPC y verifica versión y estructura antes de abrir la API.

```text
participación oficial = votaron / (votaron + no votaron)
abstención oficial    = no votaron / (votaron + no votaron)
```

Las respuestas conservan fuente, universo, periodo, advertencias y campos usados en cada cálculo.

## Interfaz generativa

El compositor selecciona componentes según la intención y los datos disponibles: resumen, comparación, línea del tiempo, ranking territorial, mapa, desglose demográfico, evidencia o metodología.

La salida es una DSL validada; no contiene HTML ni JavaScript ejecutable. Las interacciones visuales simples se resuelven sin invocar el modelo. Los cambios que requieren datos vuelven al planificador y a las herramientas.

## Persistencia

El modo `local_sqlite` crea el archivo indicado en `SQLITE_DATABASE_PATH`. La carpeta `.local/` está excluida de Git.

El modo `supabase` utiliza las migraciones de sesión y snapshots incluidas en `supabase/migrations`. El directorio conserva migraciones heredadas porque las RPC de sesión actuales mantienen referencias a ese esquema. El modo predeterminado `local_sqlite` no las ejecuta.

## Validación

```bash
pnpm typecheck
pnpm test
pnpm test:civic
pnpm acceptance:verify
pnpm build
pnpm security:audit
```

Evaluación opcional:

```bash
pnpm eval:planner
```

El reporte se escribe en `.local/planner-evaluation.md` y no se versiona.

## Estructura

```text
src/http/                    API HTTP y transporte
src/agent/                   planificación, políticas, prompts y stream
src/tools/                   herramientas MCP
src/services/                servicio de datos cívicos
src/application/ports/       interfaces de datos, sesión y voz
src/infrastructure/ccpc/     adaptador CCPC
src/fixtures/                muestra cívica incluida
src/ui/                      composición y validación de UI
src/integration/             sesión, eventos y transformaciones
src/repositories/            persistencia SQLite y Supabase
packages/contracts/          contrato compartido
tests/                       pruebas unitarias, integración y aceptación
```

## Seguridad

- CORS sólo permite orígenes explícitos.
- Las solicitudes tienen límite de tamaño.
- Autenticación, herramientas y operaciones costosas tienen rate limits separados.
- La política cívica rechaza datos personales, predicciones y recomendaciones de voto.
- El logger filtra tokens y claves.
- Las herramientas tienen timeout, reintentos limitados y validación de entrada y salida.

## Solución de problemas

### `EADDRINUSE`

Ya existe otro proceso usando el puerto 3101. Identifícalo:

```bash
ss -ltnp '( sport = :3101 )'
```

Detén la instancia anterior con `Ctrl+C` en la terminal donde se inició. Sólo si esa terminal ya no existe, toma el número que aparece como `pid=...` y ejecuta `kill NUMERO`; después vuelve a usar `pnpm api`.

### `401 Unauthorized`

Confirma que `AGENT_API_TOKEN` sea idéntico en `back-end/.env` y `front-end/.env.local`. Reinicia ambos procesos después de corregirlo.

### `corepack` o `pnpm` no existe

```bash
npm install --global corepack
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm --version
```

Ejecuta estos comandos desde `back-end/`. La versión esperada es `10.34.5`.

### El estado no abre o `curl` muestra `Connection refused`

Revisa la terminal de `pnpm api`: ahí aparece la causa del fallo. Confirma que `AGENT_API_HOST=127.0.0.1`, `AGENT_API_PORT=3101` y que no haya otra instancia usando el puerto.

### Gemini no responde

Verifica `UI_PLANNER_MODE=gemini`, `GEMINI_API_KEY`, el modelo y la conexión a internet. Después de cambiar `.env`, reinicia `pnpm api`. Para aislar el problema y operar sin Gemini usa temporalmente `UI_PLANNER_MODE=rules`.

### El motor CCPC no carga

Ejecuta esta comprobación desde `back-end/`:

```bash
test -f ../data-release/Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06/src/data/dataset-v1.ts && echo "Módulo: OK"
test -f ../data-release/Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06/data/ccpc/full/participation.compact.json && echo "Dataset: OK"
```

Si alguno no imprime `OK`, revisa dónde descomprimiste el release y corrige `CCPC_DATA_DIR`. Si ambos existen, entra a la carpeta del release y ejecuta `npm ci --ignore-scripts`. El endpoint de estado informa la fuente activa.

### La instalación de dependencias falla

Confirma la versión de Node con `node --version`, activa pnpm 10.34.5 y vuelve a ejecutar:

```bash
pnpm install --frozen-lockfile
```

No borres el lockfile ni cambies a `npm install`, porque produciría un árbol de dependencias diferente al validado.
