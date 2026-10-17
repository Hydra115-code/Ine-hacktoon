# INE GenUI — Frontend

Frontend en migración para una experiencia de **exploración ciudadana con interfaz generativa**. El usuario formula una pregunta sobre datos públicos y el sistema construye una vista útil con componentes propios —métricas, tablas, gráficas, filtros y controles— que después puede modificar mediante conversación o interacción directa.

> Estado actual: `INT-08` completado. La consulta y el refinamiento conversacional funcionan contra Gemini, las tools MCP y la muestra CCPC trazable; compilación, contratos, accesibilidad, responsive, recuperación y rendimiento tienen una verificación reproducible.

Este repositorio no contiene pantallas prearmadas para cada pregunta. Renderiza una especificación declarativa y segura producida por el agente; las rutas `/dev/*` son únicamente harnesses de validación y no forman parte de la experiencia productiva.

## Qué demuestra

- El LLM interpreta la intención; no funciona sólo como chatbot.
- La UI se genera con una DSL tipada equivalente a la capa A2UI requerida por el reto.
- La interfaz puede cambiar por instrucciones como “deja sólo la tabla” o por eventos de sus controles.
- Cada evento conserva `sessionId`, revisión de UI y revisión de datos para mantener continuidad.
- El navegador nunca recibe las claves de Gemini ni ElevenLabs.
- La migración mantiene el renderer seguro, el streaming y la edición conversacional mientras sustituye el dominio financiero por datos públicos del INE.

## Arquitectura del frontend

```mermaid
flowchart LR
    U[Usuario: texto, voz o control] --> C[Chat y compositor]
    C --> Z[Estado de experiencia<br/>Zustand]
    Z --> A[AI SDK: useChat]
    A --> N[Route Handler de Next.js<br/>/api/agent]
    N -->|Token interno + NDJSON| B[Backend del agente]
    B -->|texto, datos, UI, patches y estado| N
    N --> A
    A --> P[Motor de datos y patches]
    P --> R[Renderer seguro de GenUI]
    R --> D[Componentes propios<br/>KPIs, tablas, gráficas, filtros]
    D -->|UIEvent semántico| Z
    Z -->|nueva acción o nueva UI| A

    C -. voz .-> V[Route Handler de ElevenLabs]
    V -. transcripción .-> C
    L[Sesión local del navegador] --> N
```

### Flujo de una consulta y una edición

```mermaid
sequenceDiagram
    actor Usuario
    participant Chat as Chat / componentes
    participant Next as Next.js server
    participant Agent as Backend agente
    participant UI as Renderer GenUI

    Usuario->>Chat: Pregunta sobre datos públicos
    Chat->>Next: Mensajes + sesión
    Next->>Agent: POST /api/agent + token interno
    Agent-->>Next: Stream: texto + datos + UI
    Next-->>Chat: Eventos adaptados a AI SDK
    Chat->>UI: Valida y renderiza la especificación
    Usuario->>UI: Filtra, ordena o solicita un cambio
    UI->>Next: UIEvent + revisiones + estado actual
    Next->>Agent: Continuación de la misma sesión
    Agent-->>UI: Patch o nueva especificación
```

## Tecnologías

| Capa | Implementación |
|---|---|
| Aplicación | Next.js 16, React 19 y TypeScript |
| Conversación/stream | Vercel AI SDK (`ai`, `@ai-sdk/react`) |
| Estado | Zustand |
| Contratos | Zod y paquete compartido `@ine/contracts` |
| Visualización | ECharts, tablas y componentes propios |
| Movimiento | Motion |
| Sesión local | Identidad pública estable en frontend + SQLite en backend |
| Seguridad entre servicios | Token privado agregado exclusivamente por Next.js |
| Voz | ElevenLabs con creación server-side de sesión efímera |

## Requisitos

- Git.
- Node.js **22 LTS** recomendado (el mínimo técnico del frontend es 20.9, pero el backend exige 22).
- Corepack habilitado.
- Backend INE compatible con los contratos compartidos del motor GenUI.

## Instalación desde cero

```bash
git clone --branch front-end git@github.com:Hydra115-code/Ine-hacktoon.git
cd Ine-hacktoon
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Configura `.env.local`:

```dotenv
AI_PROVIDER=google
AGENT_API_URL=http://127.0.0.1:3101/api/agent
AGENT_SESSION_MODE=local_service
AGENT_API_TOKEN=EL_MISMO_SECRETO_DEL_BACKEND
INE_DEMO_LOGIN_ENABLED=false
INE_DEMO_EMAIL=
INE_DEMO_PASSWORD=
```

| Variable | Obligatoria | Uso |
|---|---:|---|
| `AGENT_API_URL` | Sí | Endpoint completo `/api/agent` del backend. En producción debe usar HTTPS. |
| `AI_PROVIDER` | No | Identificador de proveedor; actualmente `google`. |
| `AGENT_SESSION_MODE` | Sí | Usa `local_service` durante INT-06. |
| `AGENT_API_TOKEN` | Sí en modo local | Secreto servidor-a-servidor; no usar prefijo `NEXT_PUBLIC_`. |
| `INE_DEMO_LOGIN_ENABLED` | No | Muestra “Entrar a demostración” cuando también existen email y contraseña. |
| `INE_DEMO_EMAIL` | Condicional | Cuenta sintética de demo; sólo variable server-side. |
| `INE_DEMO_PASSWORD` | Condicional | Secreto de demo; nunca usar prefijo `NEXT_PUBLIC_`. |

No copies el `.env` de otra máquina ni subas secretos. El navegador no recibe `AGENT_API_TOKEN`: la ruta server-side de Next.js lo agrega al solicitar el stream del backend. El código de Supabase permanece disponible, pero está inactivo mientras `AGENT_SESSION_MODE=local_service`.

## Ejecución local

1. Arranca primero el backend en `127.0.0.1:3101` siguiendo su README.
2. En este repositorio ejecuta:

```bash
pnpm dev
```

3. Abre [http://127.0.0.1:3000](http://127.0.0.1:3000).
4. Entra directamente a `/conversar`; no se requiere cuenta durante el modo local.

Para que la comunicación funcione, el backend debe incluir exactamente `http://127.0.0.1:3000` y/o `http://localhost:3000` en `AGENT_API_ALLOWED_ORIGINS`.

## Build de producción

```bash
pnpm build
pnpm start
```

El despliegue necesita un runtime **Node.js** compatible con streaming y variables server-side; no debe exportarse como sitio completamente estático.

## ¿Es obligatorio subirlo a la nube?

**No.** El documento del reto deja el proveedor de infraestructura a libre elección. Exige una demo en vivo, un repositorio ejecutable, datos/APIs y documentación técnica; no impone Vercel, Supabase hosted ni otro proveedor concreto.

Para evaluación remota sí es recomendable desplegarlo:

```mermaid
flowchart LR
    Browser[Navegador HTTPS] --> Front[Next.js en runtime Node]
    Front -->|HTTPS + token interno| Back[Backend Node persistente]
    Back --> DB[(SQLite persistente)]
    Back --> Gemini[Gemini]
    Front -->|sesión server-side| Eleven[ElevenLabs]
```

En nube configura `AGENT_API_URL=https://backend.example.com/api/agent`, registra el origen exacto del frontend en el CORS del backend y mantiene todas las credenciales en el gestor de secretos de la plataforma.

## Validación

Comprobaciones mínimas antes de una demo:

```bash
pnpm int-08:verify
```

Este comando compila producción y ejecuta INT-01 a INT-06, sincronización/recuperación de patches, seguridad, accesibilidad y rendimiento. INT-07 se valida en vivo porque requiere Gemini y el backend activos.

Pruebas de integración que requieren el backend activo:

```bash
pnpm integration:agent-text:verify
pnpm integration:agent-ui:verify
pnpm integration:streaming-ui:verify
pnpm integration:ui-interaction:verify
pnpm integration:patch-sync:verify
```

Los harnesses bajo `/dev/*` sólo se incluyen en desarrollo para inspeccionar contratos, streaming, recuperación e interacciones.

## Contratos y seguridad

- `packages/contracts` publica un núcleo neutral; la compatibilidad anterior vive únicamente en `@ine/contracts/legacy-financial` y no participa en el fingerprint principal.
- La UI aceptada es una estructura declarativa validada; no se ejecuta HTML o JavaScript generado por el modelo.
- Los eventos incluyen correlación, sesión y revisiones para evitar aplicar cambios obsoletos.
- El navegador usa una identidad pública estable; Next.js autentica la llamada servidor-a-servidor y el backend aísla sesiones y snapshots por actor local.
- Ante pérdida de stream, conflicto de revisión o UI inválida, el frontend recupera snapshot o muestra una degradación segura.
- Nunca expongas `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_ACCESS_TOKEN` o `service_role` al navegador.

## Correspondencia con los entregables del reto

| Entregable | Evidencia en este repositorio |
|---|---|
| Componentes generativos | `src/features/generative-ui` y `src/shared/design-system` |
| Capa A2UI o equivalente | Contratos `UISpecification`, data registry, patches y renderer seguro |
| Ciclo cerrado | `UIEvent` vuelve al agente y produce una acción, patch o nueva UI |
| UI funcional y adaptable | Texto/voz, controles, tablas, gráficas, filtros y estados responsivos |
| Instrucciones de ejecución | Instalación, entorno, desarrollo, build y pruebas en este README |
| Arquitectura/trade-offs | Diagramas y decisiones documentadas aquí; coordinación completa en ambos README |

## Decisiones y trade-offs

- **DSL segura frente a código libre:** limita composiciones arbitrarias, pero evita ejecutar código generado y mantiene accesibilidad/identidad visual.
- **Streaming frente a respuesta única:** muestra progreso y reduce la espera percibida, a cambio de revisiones, patches y recuperación más complejos.
- **BFF de Next frente a llamadas directas:** añade un salto de red, pero protege tokens y normaliza autenticación y stream.
- **Componentes propios frente a pantallas por intención:** requiere un catálogo sólido, pero permite variación real sin esconder plantillas fijas.
- **Migración incremental:** conserva el motor GenUI validado mientras reemplaza dominio, datos y componentes en fases verificables.

## Estructura relevante

```text
src/app/                         rutas, layout y endpoints server-side
src/features/agent/              sesión, transporte y adaptación del stream
src/features/auth/               compatibilidad opcional con sesión Supabase
src/features/generative-ui/      runtime, renderer, patches e interacciones
src/features/voice/              experiencia de transcripción
src/features/workspace/          chat y área de trabajo
src/shared/design-system/        componentes visuales propios
packages/contracts/              contrato compartido con el backend
scripts/                         validaciones de contrato, UX, seguridad y rendimiento
```

## Checklist de demo

1. Backend y frontend reportan estado saludable y la fuente CCPC activa.
2. La muestra utilizada se identifica como muestra y conserva fuente, fecha de consulta y huella.
3. Una pregunta abierta produce una UI adecuada, no una pantalla fija.
4. Un filtro o edición conversacional modifica la vista existente.
5. La interacción directa vuelve al agente y conserva sesión y revisiones.
6. Ningún secreto aparece en DevTools, logs o repositorio.
