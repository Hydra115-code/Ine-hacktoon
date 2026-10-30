# INE Explora con Paper

Repositorio integrado del explorador ciudadano de datos públicos del INE. La aplicación recibe preguntas abiertas, consulta la información disponible del CCPC y construye vistas verificables con tablas, gráficas, mapas, líneas del tiempo y controles interactivos.

## Estructura

```text
front-end/   Aplicación Next.js y motor de interfaz generativa
back-end/    API, agente, herramientas cívicas y persistencia SQLite
data/        Datos CCPC, normalización, validación y consultas
docs/qa/     Casos de aceptación, accesibilidad y evidencia de QA
scripts/     Inicialización segura y verificación integral
```

Los commits utilizados para construir esta integración están registrados en [`integration-sources.json`](integration-sources.json).

## Requisitos

- Git.
- Node.js 22 desde la versión 22.18, o Node.js 23.6 o posterior.
- Corepack, incluido con Node.js.
- `pnpm`, administrado mediante Corepack.
- `unzip` y `sha256sum` en Linux, o `unzip` y `shasum` en macOS.

No se requiere una suscripción de base de datos. El modo local utiliza SQLite y el planificador por reglas funciona sin Gemini.

Comprueba las versiones:

```bash
node --version
corepack --version
corepack pnpm --version
```

## Instalación

Desde la raíz del repositorio:

```bash
corepack enable

./scripts/prepare-data-release.sh
./scripts/install-data-dependencies.sh

cd back-end
corepack pnpm install --frozen-lockfile

cd ../front-end
corepack pnpm install --frozen-lockfile

cd ..
```

También puede instalarse y validarse todo con:

```bash
./scripts/verify-all.sh --install
```

## Archivos de entorno

Inicializa las configuraciones locales con:

```bash
./scripts/init-local-env.sh
```

El script crea, sólo cuando no existen:

```text
back-end/.env
front-end/.env.local
```

Ambos archivos están ignorados por Git y se crean con permisos privados. Nunca escribas credenciales en `.env.example`, el README, un commit o una captura de pantalla.

Además conecta el release completo de datos, genera un token local cuando hace falta y lo sincroniza entre backend y frontend sin imprimirlo. Si los archivos ya existen, conserva las claves privadas y sólo normaliza los valores locales de integración.

### Configuración local mínima

En `back-end/.env`:

```dotenv
AUTH_MODE="local_sqlite"
SQLITE_DATABASE_PATH=".local/ine-explora.sqlite"
CCPC_DATA_DIR="../data-release/Ine-hacktoon-DATA-06"
CCPC_DATASET_PATH="data/ccpc/full/participation.compact.json"
UI_PLANNER_MODE="rules"
AGENT_API_HOST="127.0.0.1"
AGENT_API_PORT="3101"
AGENT_API_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
AGENT_API_TOKEN="REEMPLAZAR_CON_UN_TOKEN_LOCAL_DE_32_CARACTERES_O_MAS"
```

En `front-end/.env.local`:

```dotenv
AGENT_API_URL="http://127.0.0.1:3101/api/agent"
AGENT_SESSION_MODE="local_service"
AGENT_API_TOKEN="EL_MISMO_TOKEN_CONFIGURADO_EN_EL_BACKEND"
```

Genera un token local con:

```bash
openssl rand -hex 32
```

El token debe ser idéntico en backend y frontend.

### Gemini opcional

Gemini sólo se configura en `back-end/.env`:

```dotenv
UI_PLANNER_MODE="gemini"
GEMINI_API_KEY="TU_CLAVE"
GEMINI_MODEL="gemini-3.7-flash"
```

No copies `GEMINI_API_KEY` al frontend y nunca uses un prefijo `NEXT_PUBLIC_` para secretos.

## Ejecución

Terminal 1:

```bash
cd back-end
corepack pnpm api
```

Terminal 2:

```bash
cd front-end
corepack pnpm dev
```

Abre `http://127.0.0.1:3000`.

Comprueba el backend:

```bash
curl http://127.0.0.1:3101/api/system/status
```

La respuesta debe indicar la fuente de datos activa, el modo de autenticación y el planificador configurado.

## Validación

Auditoría de seguridad del repositorio:

```bash
./scripts/check-repository-safety.sh
```

Validación completa con dependencias ya instaladas:

```bash
./scripts/verify-all.sh
```

Validaciones individuales:

```bash
./scripts/verify-data.sh
cd back-end && corepack pnpm int-08:verify
cd ../front-end && corepack pnpm int-08:verify
```

### Prueba end-to-end en ejecución

Con backend y frontend iniciados en terminales separadas, ejecuta desde la raíz:

```bash
node scripts/verify-live-e2e.mjs
```

La prueba comprueba el estado de ambos servicios, la compatibilidad contractual, la autenticación privada entre servidores y una consulta ciudadana completa con datos oficiales, texto e interfaz generativa. No imprime tokens ni el contenido de los archivos de entorno.

## Reglas de seguridad

- No subir `.env`, `.env.local`, bases SQLite, logs, builds ni `node_modules`.
- Mantener Gemini, ElevenLabs y cualquier token de servicio únicamente en el backend.
- Usar datos agregados y públicos; no incorporar padrones ni identificadores personales.
- Revisar `git status` antes de cada commit.
- Ejecutar la auditoría de seguridad antes de abrir un pull request.
