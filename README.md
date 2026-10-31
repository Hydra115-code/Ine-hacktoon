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

## Inicio rápido

En una máquina nueva, después de clonar `main`, sólo necesitas dos comandos. Son idénticos en Windows, Linux y macOS:

```bash
node setup.mjs
node start.mjs
```

El primero prepara el release CCPC, instala Data, Back y Front con pnpm, crea los archivos privados de entorno y valida la configuración. El segundo levanta ambos servicios, espera a que estén listos y los cierra juntos al presionar `Ctrl+C`.

También puedes usar los accesos directos nativos:

```text
Windows (PowerShell o CMD):  .\setup.cmd       y .\start.cmd
Linux, macOS o Git Bash:     ./scripts/setup-local.sh y ./scripts/start-local.sh
```

Abre `http://127.0.0.1:3000`.

## Requisitos

- Git.
- Node.js 22 desde la versión 22.18, o Node.js 23.6 o posterior.
- Corepack, incluido con Node.js.
- `pnpm`, administrado mediante Corepack.
- `unzip` en Linux o macOS. En Windows se utiliza PowerShell para extraer el release.

No se requiere una suscripción de base de datos. El modo local utiliza SQLite y el planificador por reglas funciona sin Gemini.

Comprueba las versiones:

```bash
node --version
corepack --version
corepack pnpm@12.16.1 --version
```

La versión esperada de pnpm es `12.16.1`.

## Instalación paso a paso

No ejecutes `npm install`. El repositorio usa `pnpm` mediante Corepack y los scripts se encargan de instalar cada módulo con la versión correcta.

### Windows 10 con Git Bash

1. Instala **Git for Windows** y una versión compatible de **Node.js**.
2. Cierra y vuelve a abrir Git Bash para actualizar el `PATH`.
3. Comprueba que las herramientas estén disponibles:

   ```bash
   git --version
   node --version
   corepack --version
   ```

   `node --version` debe mostrar `v22.18.0` o una versión posterior compatible.

4. Entra en la carpeta donde guardarás el proyecto y clona `main`:

   ```bash
   cd ~/Documents
   git clone --branch main https://github.com/Hydra115-code/Ine-hacktoon.git
   cd Ine-hacktoon
   ```

5. Confirma que estás en la raíz correcta. Debes ver `front-end`, `back-end`, `data` y `setup.mjs`:

   ```bash
   pwd
   ls
   git branch --show-current
   ```

6. Prepara datos, dependencias y configuración local:

   ```bash
   node setup.mjs
   ```

   El proceso conserva cualquier `.env` existente, genera un token local sin mostrarlo y conecta frontend y backend con SQLite.

7. Inicia el producto completo:

   ```bash
   node start.mjs
   ```

8. Espera a ver `backend: listo` y `frontend: listo`. Después abre `http://127.0.0.1:3000`.
9. Para detener ambos servicios, vuelve a Git Bash y presiona `Ctrl+C` una vez.

También puedes usar los accesos directos de Windows desde PowerShell o CMD:

```powershell
cd "$HOME\Documents\Ine-hacktoon"
.\setup.cmd
.\start.cmd
```

### Linux

1. Instala Git, `unzip`, Node.js y Corepack. En Ubuntu o Debian, Git y `unzip` pueden instalarse con:

   ```bash
   sudo apt update
   sudo apt install -y git unzip
   ```

2. Comprueba las versiones:

   ```bash
   git --version
   node --version
   corepack --version
   ```

3. Clona `main` y entra al repositorio:

   ```bash
   cd ~/Documents
   git clone --branch main https://github.com/Hydra115-code/Ine-hacktoon.git
   cd Ine-hacktoon
   ```

4. Instala y configura todo:

   ```bash
   node setup.mjs
   ```

5. Inicia frontend y backend:

   ```bash
   node start.mjs
   ```

6. Abre `http://127.0.0.1:3000`. Presiona `Ctrl+C` para cerrar ambos servicios.

### Activar Gemini opcionalmente

La instalación usa el planificador local por reglas de forma predeterminada. Para usar Gemini, abre `back-end/.env` y configura únicamente en ese archivo:

```dotenv
UI_PLANNER_MODE="gemini"
GEMINI_API_KEY="TU_CLAVE_REAL"
GEMINI_MODEL="gemini-3.7-flash"
```

Guarda el archivo y reinicia con `node start.mjs`. La clave no debe copiarse al frontend ni subirse a Git.

### Actualizar una instalación existente

Detén los servicios y, desde la raíz del repositorio, ejecuta:

```bash
git switch main
git pull --ff-only origin main
node setup.mjs
node start.mjs
```

### Diagnóstico rápido

- `No such file or directory`: confirma con `pwd` y `ls` que estás dentro de `Ine-hacktoon`, no dentro de `front-end` o `back-end`.
- `node: command not found` o `node no se reconoce`: instala Node.js compatible y vuelve a abrir la terminal.
- `corepack no se reconoce`: la instalación de Node está incompleta o no quedó en el `PATH`; reinstálala y abre una terminal nueva.
- `EADDRINUSE`: los puertos `3000` o `3101` ya están ocupados. Cierra la ejecución anterior antes de iniciar otra.
- Instalación incompleta: vuelve a ejecutar `node setup.mjs`; el proceso es seguro para repetirse y conserva las claves existentes.
- Para validar todo después de instalar: ejecuta `node verify.mjs`.

## Instalación

Desde la raíz del repositorio, si quieres ejecutar cada paso manualmente:

```bash
node scripts/prepare-data-release.mjs
node scripts/install-data-dependencies.mjs

cd back-end
corepack pnpm install --frozen-lockfile

cd ../front-end
corepack pnpm install --frozen-lockfile

cd ..
```

También puede instalarse y validarse todo con:

```bash
node verify.mjs --install
```

La instalación simplificada y multiplataforma es:

```bash
node setup.mjs
```

Agrega `--verify` para ejecutar también todas las pruebas:

```bash
node setup.mjs --verify
```

## Archivos de entorno

Inicializa las configuraciones locales con el script portable:

```bash
node scripts/init-local-env.mjs
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

El instalador genera el token automáticamente. Si necesitas crear uno manualmente, este comando funciona en Windows y Linux:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
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

La forma recomendada es iniciar todo desde la raíz. El comando es el mismo en Windows y Linux:

```bash
node start.mjs
```

También puedes iniciar cada servicio por separado:

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
node scripts/check-repository-safety.mjs
```

Validación completa con dependencias ya instaladas:

```bash
node verify.mjs
```

Validaciones individuales:

```bash
node scripts/verify-data.mjs
cd back-end && corepack pnpm int-08:verify
cd ../front-end && corepack pnpm int-08:verify
```

### Prueba end-to-end en ejecución

Con backend y frontend iniciados en terminales separadas, ejecuta desde la raíz:

```bash
node scripts/verify-live-e2e.mjs
```
