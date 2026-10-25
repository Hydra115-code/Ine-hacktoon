# INE Explora — Backend

API y servidor MCP para consultas de participación electoral. El servicio interpreta preguntas, consulta datos CCPC agregados, valida la evidencia y transmite texto, datos e interfaces declarativas al frontend.

## Requisitos

- Node.js 22 o superior.
- Corepack.
- pnpm 10.34.5.

Gemini, ElevenLabs y Supabase son opcionales. El modo predeterminado utiliza reglas locales, SQLite y la muestra CCPC incluida.

## Instalación

```bash
git clone --branch Back-end git@github.com:Hydra115-code/Ine-hacktoon.git ine-explora-back
cd ine-explora-back
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

## Configuración mínima

```dotenv
AUTH_MODE=local_sqlite
SQLITE_DATABASE_PATH=.local/ine-explora.sqlite
LOCAL_ACTOR_ID=10000000-0000-4000-8000-000000000001
UI_PLANNER_MODE=rules
AGENT_API_HOST=127.0.0.1
AGENT_API_PORT=3101
AGENT_API_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
AGENT_API_TOKEN=replace-with-at-least-32-random-characters
```

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
| `AGENT_API_TOKEN` | Token compartido con el frontend. |
| `AGENT_API_ALLOWED_ORIGINS` | Orígenes permitidos separados por comas. |
| `ELEVENLABS_API_KEY` | Habilita transcripción en tiempo real. |
| `SUPABASE_URL` | Proyecto utilizado en modo `supabase`. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase. |

Consulta `.env.example` para límites, timeouts y variables adicionales.

## Ejecución

API para el frontend:

```bash
pnpm api
```

Estado:

```bash
curl -i http://127.0.0.1:3101/api/system/status
```

Servidor MCP por `stdio`:

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

```bash
ss -ltnp '( sport = :3101 )'
```

Detén el proceso identificado antes de iniciar otra instancia.

### `401 Unauthorized`

Confirma que el frontend envía el mismo `AGENT_API_TOKEN`.

### Gemini no responde

Verifica `UI_PLANNER_MODE=gemini`, `GEMINI_API_KEY`, el modelo y la conectividad. Para operar sin Gemini usa `UI_PLANNER_MODE=rules`.

### El motor CCPC no carga

Comprueba `CCPC_DATA_DIR`, `CCPC_DATASET_PATH` y permisos de lectura. El endpoint de estado informa la fuente activa.
