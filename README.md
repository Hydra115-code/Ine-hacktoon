# INE Explora — Backend

API que responde preguntas ciudadanas sobre participación electoral con datos oficiales del CCPC. Interpreta la pregunta, consulta los datos con herramientas MCP, verifica las cifras y envía al frontend el texto, los datos y una interfaz declarativa (gráficas, tablas, rankings, líneas del tiempo) que después se puede editar conversando.

## Cómo funciona

```text
POST /api/agent
  ├─ autenticación por token, CORS y límites de uso
  ├─ filtro de temas: sólo participación electoral; sin datos personales,
  │  predicciones ni recomendaciones de voto
  ├─ planificador (reglas, Gemini o modelo local) → plan validado con Zod
  ├─ herramientas MCP → datos CCPC
  ├─ respuesta verificada: conserva cifras, numerador y denominador, fuente
  ├─ compositor de interfaz según la intención y la forma de los datos
  ├─ sesión y última vista en SQLite
  └─ stream NDJSON hacia el frontend
```

Las ediciones de la vista ("deja sólo la tabla", "ordénalo de menor a mayor", "regresa a la vista anterior") se aplican sobre la vista guardada, sin volver a consultar los datos.

## Requisitos

- Node.js 22.18 o posterior (el release de datos CCPC no funciona con versiones anteriores).
- pnpm mediante Corepack, en la versión indicada en `packageManager` de `package.json`. No uses `npm install`.
- El release de datos CCPC 1.0.0 de la rama `Data`.

## Instalación

### Desde el repositorio integrado (recomendado)

Si clonaste la rama `main`, el backend está en `back-end/` y se instala junto con los datos y el frontend desde la raíz:

```bash
node setup.mjs
node start.mjs
```

`setup.mjs` prepara los datos, instala dependencias y crea `back-end/.env` con modo `local_sqlite`, planificador `rules` y un token compartido con el frontend. Consulta el `README.md` de la raíz para más detalles.

### Sólo el backend

1. Instala dependencias desde la carpeta del backend:

   ```bash
   corepack enable
   corepack pnpm install --frozen-lockfile
   ```

   En Windows, si `corepack enable` falla por permisos, instala los accesos en una carpeta de usuario y agrégala al `PATH`:

   ```powershell
   corepack enable --install-directory "$env:LOCALAPPDATA\corepack-shims" pnpm
   $env:PATH = "$env:LOCALAPPDATA\corepack-shims;$env:PATH"
   ```

2. Prepara los datos. Desde la rama `Data`, verifica y descomprime el release junto a la carpeta del backend:

   ```bash
   sha256sum -c Entrega-final-CCPC-1.0.0.zip.sha256
   unzip Entrega-final-CCPC-1.0.0.zip -d ../data-release
   cd ../data-release/Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06
   npm ci --ignore-scripts
   ```

   En Windows (PowerShell), compara el resultado de `Get-FileHash Entrega-final-CCPC-1.0.0.zip` con el archivo `.sha256` y descomprime con `Expand-Archive Entrega-final-CCPC-1.0.0.zip ..\data-release`. No modifiques los archivos del release: el backend verifica su integridad al arrancar.

3. Crea la configuración local copiando `.env.example` a `.env` y deja, como mínimo:

   ```dotenv
   AUTH_MODE=local_sqlite
   SQLITE_DATABASE_PATH=.local/ine-explora.sqlite
   CCPC_DATA_DIR=../data-release/Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06
   CCPC_DATASET_PATH=data/ccpc/full/participation.compact.json
   UI_PLANNER_MODE=rules
   AGENT_API_HOST=127.0.0.1
   AGENT_API_PORT=3101
   AGENT_API_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   AGENT_API_TOKEN=token-local-de-32-caracteres-o-mas
   ```

   `AUTH_MODE=local_sqlite` debe escribirse explícitamente. Genera el token con:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   El frontend debe usar exactamente el mismo `AGENT_API_TOKEN`. Nunca subas `.env` a Git.

4. Inicia la API:

   ```bash
   corepack pnpm api
   ```

5. Comprueba el estado en otra terminal:

   ```bash
   curl http://127.0.0.1:3101/api/system/status
   ```

   En PowerShell: `Invoke-RestMethod http://127.0.0.1:3101/api/system/status`. El encabezado `X-Ui-Planner` indica el planificador activo.

## Planificadores

| `UI_PLANNER_MODE` | Requiere | Comportamiento |
|---|---|---|
| `rules` (por defecto) | Nada | Reglas deterministas: entienden estados, gentilicios, años, sexo, edad, tipo de sección y el tipo de análisis. Si falta información, piden aclaración. |
| `gemini` | `GEMINI_API_KEY` | Primero responden las reglas; Gemini interpreta las preguntas abiertas y las ediciones que las reglas no entienden. Si tarda o propone algo inválido, contestan las reglas. |
| `local-model` | Servidor local compatible con OpenAI | Un modelo local interpreta la pregunta y, si falla o tarda, contestan las reglas. En la evaluación con 40 preguntas fue menos preciso que las reglas, por eso es opcional. |

En modo `gemini`:

- La interfaz siempre la arma el backend, nunca Gemini.
- Las ediciones de la vista se eligen de una lista cerrada de operaciones (por ejemplo "dámelo en formato gráfica").
- A Gemini se le pide no pensar (`thinkingBudget: 0`) para responder rápido; si el modelo no acepta esa opción, se usa la siguiente que sí acepte.
- La respuesta escrita es la verificada. Con `GEMINI_ANSWER_TIMEOUT_MS` mayor que `0`, Gemini la redacta con otras palabras sin poder cambiar cifras.

Configuración mínima:

```dotenv
UI_PLANNER_MODE=gemini
GEMINI_API_KEY=tu-clave
GEMINI_MODEL=gemini-3.7-flash
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `AUTH_MODE` | Usar `local_sqlite`. |
| `SQLITE_DATABASE_PATH` | Archivo de sesiones y vistas guardadas. La carpeta `.local/` no se sube a Git. |
| `SESSION_RESET_ON_START` | `true` (por defecto) borra las sesiones guardadas al iniciar la API. |
| `CCPC_DATA_DIR` | Carpeta del release de datos CCPC. |
| `CCPC_DATASET_PATH` | Archivo del dataset dentro de `CCPC_DATA_DIR`. |
| `UI_PLANNER_MODE` | `rules`, `gemini` o `local-model`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Sólo en modo `gemini`. |
| `GEMINI_PLANNER_TIMEOUT_MS` | Límite para que Gemini planee; después contestan las reglas (8000). |
| `GEMINI_EDIT_TIMEOUT_MS` | Límite para que Gemini interprete una edición de la vista (4000). |
| `GEMINI_ANSWER_TIMEOUT_MS` | `0` (por defecto) usa la respuesta verificada; entre 1000 y 30000 activa la redacción con Gemini. |
| `LOCAL_MODEL_URL`, `LOCAL_MODEL_NAME`, `LOCAL_MODEL_TIMEOUT_MS` | Sólo en modo `local-model`. |
| `AGENT_API_HOST`, `AGENT_API_PORT` | Dirección de la API (`127.0.0.1:3101`). |
| `AGENT_API_TOKEN` | Token compartido con el frontend (32 caracteres o más). |
| `AGENT_API_ALLOWED_ORIGINS` | Orígenes permitidos, separados por comas. |
| `ELEVENLABS_API_KEY` | Opcional: transcripción de voz en tiempo real. |

`.env.example` incluye los límites y tiempos adicionales.

## Endpoints

| Método | Ruta | Token | Descripción |
|---|---|:---:|---|
| `GET` | `/api/system/status` | No | Salud, fuente de datos y capacidades. |
| `GET` | `/api/capabilities` | No | Capacidades del release CCPC. |
| `GET` | `/api/dataset` | No | Descripción del dataset cargado. |
| `GET` | `/api/release` | No | Datos de la publicación CCPC. |
| `POST` | `/api/agent` | Sí | Pregunta, edición o evento de la interfaz; responde con NDJSON. |
| `POST` | `/api/agent/snapshot` | Sí | Recupera la última vista válida de la sesión. |
| `POST` | `/api/transcription/realtime-session` | Sí | Crea una sesión de voz de corta duración. |

Si los datos CCPC no están configurados o no pasan la verificación, la API inicia en modo degradado y `/api/agent` responde `503`.

## Herramientas MCP

| Herramienta | Resultado |
|---|---|
| `get_participation_summary` | Participación de un territorio en una elección. |
| `compare_elections` | Comparación entre elecciones y diferencia en puntos porcentuales. |
| `get_participation_breakdown` | Desglose por entidad, sexo, grupo de edad o tipo de sección. |
| `get_supporting_records` | Registros que respaldan una cifra. |

Recursos: `civic://metric-definitions` y `civic://coverage`.

```text
participación = votaron / (votaron + no votaron)
abstención    = no votaron / (votaron + no votaron)
```

## Interfaz generada

El compositor elige entre resumen, comparación de dos elecciones, línea del tiempo, ranking territorial, desglose por grupo, pirámide de edad y sexo, evidencia, metodología o datos insuficientes. Siempre incluye una tabla alternativa, salvo que la persona pida lo contrario.

La salida es una especificación validada con Zod contra el contrato compartido de `packages/contracts`; no contiene HTML ni código ejecutable.

## Pruebas

```bash
corepack pnpm typecheck
corepack pnpm test
```

`pnpm test` corre todas las pruebas sin conexión ni claves. Dos pruebas se omiten si `CCPC_DATA_DIR` no está configurado, porque usan el release real.

Otros comandos:

| Comando | Uso |
|---|---|
| `pnpm test:civic` | Planificador, herramientas, validadores e interfaz. |
| `pnpm acceptance:verify` | Ediciones de la vista y continuidad de la conversación. |
| `pnpm build` | Compila a `dist/`. Después se inicia con `pnpm api:start`. |
| `pnpm security:audit` | Revisa vulnerabilidades en dependencias de producción. |
| `pnpm eval:planner` | Compara planificadores con 40 preguntas; el reporte queda en `.local/planner-evaluation.md`. |

## Estructura

```text
src/http/                API HTTP, seguridad y estado
src/agent/               orquestador, planificadores, filtro de temas y validación de respuestas
src/tools/               herramientas MCP
src/services/            consultas de participación
src/infrastructure/      adaptadores del release CCPC y de voz
src/ui/                  compositor y validadores de la interfaz
src/integration/         sesión, ediciones de la vista y adaptación al contrato
src/repositories/        persistencia de sesiones
src/fixtures/            datos de muestra para las pruebas
packages/contracts/      contrato compartido con el frontend
tests/                   pruebas unitarias, de integración y de aceptación
scripts/                 evaluación del planificador
```

## Seguridad

- CORS sólo acepta los orígenes configurados y las solicitudes tienen límite de tamaño.
- Autenticación, consultas y herramientas tienen límites de uso por minuto.
- El filtro de temas rechaza datos personales, predicciones y recomendaciones de voto.
- El logger oculta tokens y claves.
- Las herramientas tienen tiempo límite y validan entradas y salidas.

## Solución de problemas

- **`EADDRINUSE`:** el puerto 3101 ya está ocupado. Cierra la otra instancia con `Ctrl+C`.
- **`401`:** el `AGENT_API_TOKEN` no coincide entre backend y frontend. Corrígelo y reinicia ambos.
- **`503` en `/api/agent`:** los datos CCPC no están configurados o no pasaron la verificación. Revisa `CCPC_DATA_DIR` y `CCPC_DATASET_PATH`; la terminal de la API indica la causa.
- **`Cannot find module '@banorte/contracts/dist/index.js'`:** el contrato no está compilado. Ejecuta `corepack pnpm contracts:build`.
- **`ERR_PNPM_BAD_PM_VERSION`:** se está usando otra versión de pnpm. Ejecuta los comandos con `corepack pnpm`.
- **El frontend rechaza el contrato (`contract_fingerprint_mismatch`):** en Windows, Git puede descargar los archivos del contrato con saltos de línea CRLF y la huella cambia. Configura `git config core.autocrlf false`, vuelve a descargar `packages/contracts/src` y compila de nuevo.
- **Gemini no responde:** revisa `GEMINI_API_KEY` y la conexión. Con `UI_PLANNER_MODE=rules` la API funciona sin Gemini.

## Modo Supabase (heredado)

El código todavía admite `AUTH_MODE=supabase`, que es el valor por defecto de `env.ts`, junto con los comandos de terminal con inicio de sesión (`pnpm agent`, `pnpm agent:login`, `pnpm dev`). El proyecto no lo usa: por eso `AUTH_MODE=local_sqlite` debe escribirse en `.env`. Se retirará en una limpieza posterior.
