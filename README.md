# INE Explora — Frontend

Aplicación web para consultar datos públicos de participación electoral mediante conversación e interfaces generadas. El frontend recibe especificaciones declarativas del backend, valida el contrato y las convierte en tablas, gráficas, mapas, métricas, filtros y notas metodológicas.

## Requisitos

- Node.js 22 LTS recomendado; mínimo 20.9.
- Corepack.
- Backend de INE Explora disponible en `http://127.0.0.1:3101`.

## Instalación

```bash
git clone --branch front-end git@github.com:Hydra115-code/Ine-hacktoon.git ine-explora-front
cd ine-explora-front
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
```

## Configuración

| Variable | Requerida | Descripción |
|---|---:|---|
| `AGENT_API_URL` | Sí | Endpoint del agente. Valor local: `http://127.0.0.1:3101/api/agent`. |
| `AGENT_SESSION_MODE` | Sí | Usar `local_service` para sesiones locales. |
| `AGENT_API_TOKEN` | Sí | Debe coincidir con el token del backend. Nunca usar prefijo `NEXT_PUBLIC_`. |
| `AI_PROVIDER` | No | Identificador informativo del proveedor activo. |
| `SUPABASE_URL` | No | URL de Supabase cuando se habilita autenticación remota. |
| `SUPABASE_PUBLISHABLE_KEY` | No | Clave pública de Supabase. |
| `INE_DEMO_LOGIN_ENABLED` | No | Habilita el acceso de demostración. |
| `INE_DEMO_EMAIL` | No | Cuenta sintética de demostración. |
| `INE_DEMO_PASSWORD` | No | Contraseña server-side de la cuenta sintética. |

Configuración mínima en `.env.local`:

```dotenv
AI_PROVIDER=google
AGENT_API_URL=http://127.0.0.1:3101/api/agent
AGENT_SESSION_MODE=local_service
AGENT_API_TOKEN=replace-with-the-same-token-as-the-backend
INE_DEMO_LOGIN_ENABLED=false
```

## Ejecución

Inicia primero el backend y después ejecuta:

```bash
pnpm dev
```

Rutas:

- Aplicación: `http://127.0.0.1:3000`
- Conversación: `http://127.0.0.1:3000/conversar`
- Catálogo de componentes: `http://127.0.0.1:3000/dev/genui-audit-harness`

Build de producción:

```bash
pnpm build
pnpm start
```

## Arquitectura

```text
Navegador
  └─ Workspace: conversación, historial y lienzo
       └─ Route Handler /api/agent
            └─ Backend HTTP /api/agent
                 └─ NDJSON: estado, texto, datos, UI y patches

DataRegistry + BindingResolver
  └─ UIRenderer
       ├─ componentes cívicos
       ├─ visualizaciones ECharts
       ├─ tablas y filtros
       └─ mapa de México

UIEvent
  ├─ local: selección, orden y filtros visuales
  └─ remoto: cambios semánticos y consultas de datos
```

El navegador no ejecuta HTML ni JavaScript generado. Sólo renderiza nodos aprobados por el contrato de `packages/contracts`.

## Funciones

- Preguntas abiertas y aclaraciones conversacionales.
- Streaming de texto, datos e interfaz.
- Historial y restauración de vistas.
- Edición conversacional de la interfaz.
- Interacciones locales para filtros, tablas, mapas y líneas del tiempo.
- Componentes de participación, evidencia, metodología y fuentes.
- Recuperación ante streams interrumpidos, contratos inválidos y conflictos de revisión.
- Tema claro/oscuro, navegación por teclado y tablas alternativas a gráficas.
- Paper como guía contextual.

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
public/paper/                    assets utilizados por Paper
scripts/                         pruebas de contrato, integración y UX
```

Las rutas `src/app/dev/*` son harnesses de desarrollo y auditoría.

## Validación

```bash
pnpm typecheck
pnpm build
pnpm int-08:verify
```

Pruebas con el backend activo:

```bash
pnpm integration:agent-text:verify
pnpm integration:agent-ui:verify
pnpm integration:streaming-ui:verify
pnpm integration:ui-interaction:verify
pnpm integration:patch-sync:verify
```

Validaciones específicas:

```bash
pnpm quality:verify
pnpm performance:verify
pnpm citizen-language:verify
pnpm paper:p6:verify
```

## Integración con el backend

El backend debe aceptar ambos orígenes locales:

```dotenv
AGENT_API_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

`AGENT_API_TOKEN` debe ser idéntico en ambos repositorios. Los contratos compilados también deben compartir la misma huella.

## Seguridad

- No subir `.env.local`, tokens ni claves.
- Las credenciales se agregan en Route Handlers y no se exponen al navegador.
- Nodos, bindings, eventos y patches se validan con Zod.
- Los errores técnicos se transforman a mensajes ciudadanos.
- Los eventos incluyen sesión, correlación y revisión.

## Solución de problemas

### Respuesta `401`

Verifica que `AGENT_API_TOKEN` coincida en frontend y backend.

### Backend no disponible

```bash
curl http://127.0.0.1:3101/api/system/status
```

### Puerto 3000 ocupado

```bash
ss -ltnp '( sport = :3000 )'
```

### Contratos incompatibles

Ejecuta `pnpm contracts:build` en ambos repositorios y confirma que las ramas sean compatibles.
