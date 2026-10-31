# INE Explora con Paper

Explorador ciudadano de datos públicos del Instituto Nacional Electoral. Paper recibe preguntas en lenguaje natural, consulta los Conteos Censales de Participación Ciudadana (CCPC) y construye respuestas verificables mediante tablas, gráficas, mapas, líneas del tiempo e indicadores.

## Características

- Consultas abiertas sobre participación y abstención electoral.
- Comparaciones entre entidades, grupos demográficos y elecciones disponibles.
- Interfaces generativas validadas mediante un contrato compartido.
- Evidencia, fuentes y notas metodológicas asociadas a cada resultado.
- Mapa interactivo de México, tablas accesibles y visualizaciones responsivas.
- Continuidad conversacional para refinar una vista sin repetir la consulta completa.
- Persistencia local con SQLite; no requiere una suscripción de base de datos.
- Planificador local por reglas y compatibilidad opcional con Gemini.

## Inicio rápido

### Requisitos

- Git.
- Node.js `22.18` o posterior compatible.
- Corepack.
- `unzip` en Linux o macOS. Windows utiliza PowerShell para extraer el release.

Comprueba el entorno:

```bash
git --version
node --version
corepack --version
```

### Instalación

Clona la rama `main` mediante HTTPS:

```bash
git clone --branch main https://github.com/Hydra115-code/Ine-hacktoon.git
cd Ine-hacktoon
```

Prepara los datos, dependencias, contratos y archivos privados de entorno:

```bash
node setup.mjs
```

Inicia el producto completo:

```bash
node start.mjs
```

Cuando aparezcan los mensajes `backend: listo` y `frontend: listo`, abre [http://127.0.0.1:3000](http://127.0.0.1:3000). Presiona `Ctrl+C` para detener ambos servicios.

> No ejecutes `npm install`. El repositorio utiliza pnpm `12.16.1` mediante Corepack y los scripts de la raíz administran cada módulo.

## Instalación por sistema operativo

Los comandos `node setup.mjs` y `node start.mjs` funcionan en Windows, Linux y macOS. También existen accesos directos por plataforma.

### Windows 10 u 11

Desde PowerShell o CMD:

```powershell
git clone --branch main https://github.com/Hydra115-code/Ine-hacktoon.git
cd Ine-hacktoon
node setup.mjs
node start.mjs
```

Accesos directos equivalentes:

```powershell
.\setup.cmd
.\start.cmd
```

Git Bash también admite los comandos generales indicados en Inicio rápido.

### Linux o macOS

```bash
git clone --branch main https://github.com/Hydra115-code/Ine-hacktoon.git
cd Ine-hacktoon
node setup.mjs
node start.mjs
```

Accesos directos equivalentes:

```bash
./scripts/setup-local.sh
./scripts/start-local.sh
```

## Qué hace la instalación

`node setup.mjs` ejecuta un proceso reproducible y seguro:

1. Verifica y prepara el release CCPC.
2. Instala las dependencias de Datos, Backend y Frontend con pnpm.
3. Compila los contratos compartidos.
4. Crea `back-end/.env` y `front-end/.env.local` si no existen.
5. Genera un token local y lo sincroniza entre ambos servicios.
6. Comprueba rutas, secretos e integridad del repositorio.

El proceso puede repetirse después de actualizar el repositorio. Conserva las claves privadas existentes.

Para instalar y ejecutar también la validación integral:

```bash
node setup.mjs --verify
```

## Configuración

La configuración local recomendada usa SQLite y el planificador por reglas. Los archivos `.env` están ignorados por Git y nunca deben incluirse en commits o capturas.

### Backend

Archivo `back-end/.env`:

```dotenv
AUTH_MODE="local_sqlite"
SQLITE_DATABASE_PATH=".local/ine-explora.sqlite"
CCPC_DATA_DIR="../data-release/Ine-hacktoon-DATA-06"
CCPC_DATASET_PATH="data/ccpc/full/participation.compact.json"
UI_PLANNER_MODE="rules"
AGENT_API_HOST="127.0.0.1"
AGENT_API_PORT="3101"
AGENT_API_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
AGENT_API_TOKEN="TOKEN_LOCAL_DE_32_CARACTERES_O_MAS"
```

### Frontend

Archivo `front-end/.env.local`:

```dotenv
AGENT_API_URL="http://127.0.0.1:3101/api/agent"
AGENT_SESSION_MODE="local_service"
AGENT_API_TOKEN="EL_MISMO_TOKEN_CONFIGURADO_EN_EL_BACKEND"
```

`AGENT_API_TOKEN` debe coincidir exactamente en ambos archivos. El instalador lo genera y sincroniza automáticamente.

### Gemini opcional

Gemini se configura únicamente en `back-end/.env`:

```dotenv
UI_PLANNER_MODE="gemini"
GEMINI_API_KEY="TU_CLAVE"
GEMINI_MODEL="gemini-3.7-flash"
```

Reinicia con `node start.mjs` después de modificar el archivo. La clave no debe copiarse al frontend ni utilizar el prefijo `NEXT_PUBLIC_`.

## Uso

Rutas principales:

| Ruta | Función |
|---|---|
| `/` | Presentación del producto. |
| `/conversar` | Consulta ciudadana con Paper. |
| `/historias` | Recorrido guiado con evidencia pública. |
| `/dev/genui-audit-harness` | Catálogo visual para desarrollo y QA. |

Consultas de ejemplo:

```text
Compara la participación de Jalisco y Nuevo León en 2024.
Muéstrame un mapa de participación por entidad en 2024.
¿Cómo cambió la participación en Aguascalientes entre 2009 y 2024?
Compara la participación de personas de 18 a 24 años en Ciudad de México entre 2018 y 2024.
```

Paper solicita contexto adicional cuando una pregunta no identifica territorio, grupo o periodo suficiente. No genera un análisis hasta contar con evidencia compatible.

## Arquitectura

```text
Navegador
  └─ Frontend Next.js
       ├─ conversación e historial
       ├─ renderer de UI generativa
       └─ proxy server-side
            └─ Backend HTTP
                 ├─ intérprete y planificador cívico
                 ├─ herramientas de consulta CCPC
                 ├─ validación de evidencia
                 └─ sesiones SQLite
                      └─ release CCPC verificado
```

El navegador no ejecuta HTML o JavaScript generado. El backend emite nodos declarativos y el frontend sólo renderiza componentes permitidos por el contrato compartido.

## Estructura del repositorio

```text
front-end/                aplicación Next.js e interfaz generativa
back-end/                 API, agente, herramientas cívicas y SQLite
data/                     release, normalización y validación CCPC
docs/qa/                  evidencia y casos de aceptación
scripts/                  instalación y verificación multiplataforma
setup.mjs                 instalación completa
start.mjs                 inicio coordinado de los servicios
verify.mjs                validación integral
integration-sources.json  trazabilidad de la integración
```

## Desarrollo

Para iniciar cada servicio por separado:

```bash
# Terminal 1
cd back-end
corepack pnpm api
```

```bash
# Terminal 2
cd front-end
corepack pnpm dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000). El backend escucha en `http://127.0.0.1:3101`.

### Actualizar una instalación

```bash
git switch main
git pull --ff-only origin main
node setup.mjs
node start.mjs
```

## Validación

Validación integral:

```bash
node verify.mjs
```

Validaciones por módulo:

```bash
node scripts/verify-data.mjs
cd back-end && corepack pnpm int-08:verify
cd ../front-end && corepack pnpm int-08:verify
```

Prueba end-to-end con ambos servicios activos:

```bash
node scripts/verify-live-e2e.mjs
```

Auditoría de archivos y secretos:

```bash
node scripts/check-repository-safety.mjs
```

## Seguridad y privacidad

- Los secretos permanecen en archivos locales ignorados por Git.
- El token compartido se agrega en el servidor y no se expone al navegador.
- Los contratos, eventos, bindings y patches se validan antes de renderizarse.
- Los mensajes técnicos se convierten a lenguaje ciudadano.
- El release contiene datos públicos agregados; no incluye identificadores personales directos.
- La presencia de celdas pequeñas no constituye una garantía formal de anonimato.

## Solución de problemas

### `No such file or directory`

Confirma que la terminal se encuentra en la raíz del repositorio:

```bash
pwd
ls
```

Deben existir `front-end`, `back-end`, `data` y `setup.mjs`.

### Corepack no está disponible

Instala una versión compatible de Node.js, abre una terminal nueva y comprueba `corepack --version`. Si tu distribución de Node no incluye Corepack, instálalo globalmente y vuelve a ejecutar `node setup.mjs`.

### Error `401`

Comprueba que `AGENT_API_TOKEN` sea idéntico en `back-end/.env` y `front-end/.env.local`. Reinicia ambos servicios después de corregirlo.

### Error `503`

Comprueba el estado del backend:

```bash
curl http://127.0.0.1:3101/api/system/status
```

Si aparece `contract_fingerprint_mismatch`, actualiza `main` y ejecuta nuevamente `node setup.mjs`.

### `EADDRINUSE`

Los puertos `3000` o `3101` están ocupados por otra ejecución. Detén el proceso anterior y vuelve a ejecutar `node start.mjs`.

### La instalación quedó incompleta

Vuelve a ejecutar:

```bash
node setup.mjs
```

El proceso es idempotente y conserva la configuración privada existente.

## Ramas principales

| Rama | Contenido |
|---|---|
| `main` | Producto integrado y ejecutable. |
| `front-end` | Desarrollo independiente del frontend. |
| `Back-end` | Desarrollo independiente del backend. |
| `Data` | Entrega y validación de datos CCPC. |

Para instalar el producto completo utiliza siempre `main`.
