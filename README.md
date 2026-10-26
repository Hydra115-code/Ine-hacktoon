# INE Explora — Frontend

Aplicación web para consultar datos públicos de participación electoral mediante conversación e interfaces generadas. El frontend recibe especificaciones declarativas del backend, valida el contrato y las convierte en tablas, gráficas, mapas, métricas, filtros y notas metodológicas.

## Instalación local paso a paso

Esta guía está pensada para Linux, macOS o WSL. El frontend necesita que el backend esté ejecutándose para responder consultas; la portada y el catálogo visual pueden abrirse sin él.

### 1. Instalar los requisitos

- [Git](https://git-scm.com/downloads).
- [Node.js 22 LTS](https://nodejs.org/) recomendado; la versión mínima admitida es 20.9.
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

### 2. Descargar la rama del frontend

Desde la carpeta donde quieras guardar el proyecto:

```bash
mkdir -p INE-Integracion
cd INE-Integracion
git clone --branch front-end --single-branch git@github.com:Hydra115-code/Ine-hacktoon.git front-end
cd front-end
```

Si Git muestra `Permission denied (publickey)`, configura una llave SSH en GitHub o, si tu cuenta tiene acceso, usa la URL HTTPS:

```bash
git clone --branch front-end --single-branch https://github.com/Hydra115-code/Ine-hacktoon.git front-end
cd front-end
```

Si ya descargaste esta rama, no vuelvas a clonarla: entra a su carpeta y continúa.

### 3. Instalar la versión correcta de pnpm y las dependencias

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm --version
pnpm install --frozen-lockfile
```

El resultado de `pnpm --version` debe ser `11.25.0`. No uses `npm install`: el proyecto fija sus dependencias con `pnpm-lock.yaml`.

### 4. Crear la configuración local

```bash
cp .env.example .env.local
```

Abre `.env.local` en un editor y deja, como mínimo:

```dotenv
AGENT_API_URL=http://127.0.0.1:3101/api/agent
AGENT_SESSION_MODE=local_service
AGENT_API_TOKEN=pega-aqui-el-mismo-token-del-backend
INE_DEMO_LOGIN_ENABLED=false
```

`AGENT_API_TOKEN` debe contener exactamente el mismo valor que `AGENT_API_TOKEN` en `back-end/.env`. No agregues espacios y no cambies el nombre por uno que empiece con `NEXT_PUBLIC_`, porque eso expondría el token al navegador.

### 5. Iniciar el frontend

Primero inicia el backend en otra terminal. Después, desde `front-end/`, ejecuta:

```bash
pnpm dev
```

Espera a que la terminal muestre `Ready` y abre:

- Aplicación: `http://127.0.0.1:3000`
- Conversación: `http://127.0.0.1:3000/conversar`
- Catálogo visual: `http://127.0.0.1:3000/dev/genui-audit-harness`

Mantén la terminal abierta. Para detener el frontend, presiona `Ctrl+C`.

### 6. Comprobar que quedó conectado

1. Abre `/conversar`.
2. Envía una consulta, por ejemplo: `Compara la participación de Jalisco y Nuevo León en 2024`.
3. Confirma que Paper responda y que aparezca una vista con datos.

Si la página abre pero la consulta falla, revisa primero que `http://127.0.0.1:3101/api/system/status` responda y después compara el token de ambos archivos de entorno.

### Arranque de todos los días

Después de instalar una vez, normalmente sólo necesitas dos terminales:

```bash
# Terminal 1
cd INE-Integracion/back-end
pnpm api
```

```bash
# Terminal 2
cd INE-Integracion/front-end
pnpm dev
```

No vuelvas a ejecutar `pnpm install` salvo que cambie `package.json` o `pnpm-lock.yaml`.

## Configuración de entorno

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

`AI_PROVIDER` es informativa; el proveedor que interpreta las preguntas se configura realmente en el backend. Supabase y el acceso de demostración no son necesarios para la instalación local recomendada.

## Compilación de producción

Para comprobar que el frontend puede compilarse y ejecutarse como producción:

```bash
pnpm build
pnpm start
```

`pnpm start` escucha en el puerto 3000 y requiere que `pnpm build` haya terminado correctamente.

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

Verifica que `AGENT_API_TOKEN` coincida carácter por carácter en `front-end/.env.local` y `back-end/.env`. Reinicia ambos procesos después de modificar un archivo de entorno.

### Backend no disponible

```bash
curl http://127.0.0.1:3101/api/system/status
```

Si aparece `Connection refused`, inicia el backend con `pnpm api`. Si el estado abre en el navegador pero el frontend sigue fallando, confirma que `AGENT_API_URL` termine en `/api/agent`.

### Puerto 3000 ocupado

```bash
ss -ltnp '( sport = :3000 )'
```

Detén la instancia anterior con `Ctrl+C` en la terminal donde se inició. Si necesitas usar otro puerto temporalmente:

```bash
PORT=3001 pnpm dev
```

En ese caso agrega `http://localhost:3001,http://127.0.0.1:3001` a `AGENT_API_ALLOWED_ORIGINS` del backend y reinícialo.

### `pnpm` tiene otra versión

Desde `front-end/`:

```bash
corepack prepare pnpm@11.25.0 --activate
pnpm --version
pnpm install --frozen-lockfile
```

### Cambié `.env.local` pero no ocurrió nada

Detén `pnpm dev` con `Ctrl+C` y vuelve a iniciarlo. Next.js lee estas variables al arrancar.

### Contratos incompatibles

Ejecuta `pnpm contracts:build` en ambos repositorios y confirma que las ramas sean compatibles.
