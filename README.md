# INE Explora con Paper — Frontend

Interfaz web para explorar datos públicos de participación electoral mediante conversación. El frontend recibe especificaciones declarativas del backend, valida el contrato compartido y las representa como tablas, gráficas, mapas, indicadores, filtros y notas metodológicas.

> Esta rama contiene únicamente el frontend. Para instalar el producto completo con Backend y Datos, utiliza la rama [`main`](https://github.com/Hydra115-code/Ine-hacktoon/tree/main).

## Funcionalidades

- Conversación abierta y solicitudes de contexto cuando faltan datos.
- Renderizado progresivo de interfaces generativas.
- Tablas accesibles, gráficas, mapa interactivo de México y líneas del tiempo.
- Historial, restauración de vistas y cambios consecutivos sobre un resultado.
- Interacciones locales para filtrar, seleccionar y ordenar sin consultas innecesarias.
- Tema claro y oscuro, navegación por teclado y controles de accesibilidad.
- Mensajes ciudadanos para errores, estados parciales y recuperación.
- Paper como guía contextual de la experiencia.

## Inicio rápido

### Requisitos

- [Git](https://git-scm.com/downloads).
- [Node.js](https://nodejs.org/) `20.9` o posterior; Node.js 22 LTS es la opción recomendada.
- Corepack.
- Backend compatible activo en `http://127.0.0.1:3101`.

Comprueba el entorno:

```bash
git --version
node --version
corepack --version
```

Si `corepack` no está disponible, instala una distribución reciente de Node.js que lo incluya y abre una terminal nueva.

### 1. Clonar el frontend

Utiliza HTTPS:

```bash
git clone --branch front-end --single-branch https://github.com/Hydra115-code/Ine-hacktoon.git Ine-hacktoon-front-end
cd Ine-hacktoon-front-end
```

### 2. Instalar dependencias

La rama fija pnpm `11.25.0`:

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm --version
pnpm install --frozen-lockfile
```

No ejecutes `npm install`: `pnpm-lock.yaml` es la fuente reproducible de dependencias.

### 3. Configurar el entorno

Linux, macOS o Git Bash:

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Configura como mínimo:

```dotenv
AGENT_API_URL=http://127.0.0.1:3101/api/agent
AGENT_SESSION_MODE=local_service
AGENT_API_TOKEN=EL_MISMO_TOKEN_CONFIGURADO_EN_EL_BACKEND
INE_DEMO_LOGIN_ENABLED=false
```

`AGENT_API_TOKEN` debe coincidir exactamente con el valor de `back-end/.env`. No uses el prefijo `NEXT_PUBLIC_`: expondría el secreto al navegador.

### 4. Iniciar

Con el backend activo en otra terminal:

```bash
pnpm dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000). Presiona `Ctrl+C` para detener el proceso.

### 5. Verificar la conexión

1. Abre [http://127.0.0.1:3000/conversar](http://127.0.0.1:3000/conversar).
2. Envía `Compara la participación de Jalisco y Nuevo León en 2024`.
3. Confirma que Paper responda y aparezca una vista con evidencia.

Si falla, comprueba primero el backend en [http://127.0.0.1:3101/api/system/status](http://127.0.0.1:3101/api/system/status) y después revisa el token compartido.

## Configuración

| Variable | Requerida | Uso |
|---|:---:|---|
| `AGENT_API_URL` | Sí | Endpoint del agente. |
| `AGENT_SESSION_MODE` | Sí | Usa `local_service` en desarrollo local. |
| `AGENT_API_TOKEN` | Sí | Token privado idéntico al del backend. |
| `AI_PROVIDER` | No | Referencia informativa; el proveedor real se configura en el backend. |
| `SUPABASE_URL` | No | URL de Supabase si se habilita autenticación remota. |
| `SUPABASE_PUBLISHABLE_KEY` | No | Clave pública de Supabase. |
| `INE_DEMO_LOGIN_ENABLED` | No | Habilita el acceso sintético de demostración. |
| `INE_DEMO_EMAIL` | No | Cuenta sintética de demostración. |
| `INE_DEMO_PASSWORD` | No | Contraseña server-side de demostración. |

La instalación local recomendada no requiere Supabase. Gemini, el modelo local o el planificador por reglas se eligen exclusivamente en el backend.

## Rutas

| Ruta | Función |
|---|---|
| `/` | Presentación del producto. |
| `/conversar` | Conversación y exploración de datos. |
| `/historias` | Recorrido guiado con evidencia pública. |
| `/dev/genui-audit-harness` | Catálogo de componentes para desarrollo y QA. |

Las rutas bajo `src/app/dev/` son herramientas internas de auditoría, no pantallas del flujo ciudadano.

## Arquitectura

```text
Navegador
  └─ Workspace: chat, historial y lienzo
       └─ Route Handler /api/agent
            └─ Backend /api/agent
                 └─ stream NDJSON: estado, texto, datos, UI y patches

DataRegistry + BindingResolver
  └─ UIRenderer
       ├─ componentes cívicos
       ├─ visualizaciones ECharts
       ├─ tablas y filtros
       └─ mapa de México
```

El navegador no ejecuta HTML ni JavaScript generado. Sólo representa nodos permitidos por el contrato de `packages/contracts`.

## Estructura

```text
src/app/                         rutas y endpoints server-side
src/features/agent/              sesión, transporte, stream y recuperación
src/features/generative-ui/      renderer, componentes y visualizaciones
src/features/integration/        adaptación de datos y compatibilidad
src/features/paper/              guía, reacciones y sugerencias
src/features/workspace/          conversación, historial y lienzo
src/shared/design-system/        tokens y estilos compartidos
packages/contracts/              contrato compartido
public/paper/                    assets necesarios de Paper
scripts/                         validaciones de contrato, UX e integración
```

## Desarrollo

Comandos habituales:

```bash
pnpm dev          # desarrollo con recarga automática
pnpm typecheck    # contratos y tipos TypeScript
pnpm build        # compilación de producción
pnpm start        # ejecución de la compilación
```

Validación recomendada antes de publicar cambios:

```bash
pnpm typecheck
pnpm quality:verify
pnpm build
```

Suite integral del frontend:

```bash
pnpm int-08:verify
```

Las pruebas que consultan el agente requieren un backend compatible en ejecución.

## Integración con el backend

El backend debe permitir los dos orígenes locales:

```dotenv
AGENT_API_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

También debe compartir el mismo `AGENT_API_TOKEN` y una versión compatible de `packages/contracts`.

Para obtener todo el producto desde una sola rama:

```bash
git clone --branch main https://github.com/Hydra115-code/Ine-hacktoon.git
cd Ine-hacktoon
node setup.mjs
node start.mjs
```

## Accesibilidad

- Navegación por teclado y foco visible.
- Alternativas tabulares para visualizaciones relevantes.
- Reflujo responsivo y controles de tamaño de texto.
- Temas claro, oscuro y preferencias de contraste.
- Estados y mensajes anunciables para tecnologías de asistencia.

Valida los criterios automatizados con:

```bash
pnpm a11y:04:verify
pnpm table:layout:verify
```

## Seguridad

- No subas `.env.local`, tokens ni claves.
- Las credenciales se agregan en Route Handlers server-side.
- Nodos, bindings, eventos y patches se validan antes de renderizarse.
- Los errores técnicos se convierten a mensajes comprensibles para el usuario.
- Conserva los assets de `public/paper/`; forman parte de la interfaz.

## Solución de problemas

### Error `401`

Confirma que `AGENT_API_TOKEN` coincida carácter por carácter en frontend y backend. Reinicia ambos procesos después de modificar los archivos de entorno.

### Error `503` o backend no disponible

```bash
curl http://127.0.0.1:3101/api/system/status
```

Si aparece `Connection refused`, inicia el backend. Si aparece `contract_fingerprint_mismatch`, actualiza ambas ramas y recompila sus contratos.

### Puerto `3000` ocupado

Detén la ejecución anterior con `Ctrl+C`. Para utilizar temporalmente otro puerto:

```bash
pnpm dev -- -p 3001
```

Agrega el nuevo origen a `AGENT_API_ALLOWED_ORIGINS` del backend y reinícialo.

### Versión incorrecta de pnpm

```bash
corepack prepare pnpm@11.25.0 --activate
pnpm --version
pnpm install --frozen-lockfile
```

### Los cambios de `.env.local` no se aplican

Detén `pnpm dev` con `Ctrl+C` y vuelve a iniciarlo. Next.js carga estas variables al arrancar.

## Actualización

```bash
git switch front-end
git pull --ff-only origin front-end
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```
