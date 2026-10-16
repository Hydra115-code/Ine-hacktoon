# INE Explora — Estado de integración

Actualizado: 15 de octubre de 2026.

## INT-01 — Compatibilidad contractual con el backend

**Estado: terminada.**

### Problema encontrado

El frontend y la rama `Back-end` compilan y arrancan por separado, pero publican contratos con fingerprints diferentes:

- núcleo neutral del frontend: `95e88b40…`;
- contrato generado por el backend: `7dcd9760…`.

El frontend interpretaba esta diferencia como si el backend estuviera desconectado y su endpoint `/api/system/status` respondía `503`, aunque la API estuviera disponible.

### Decisión

Se conservó el contrato neutral del frontend y se creó un adaptador explícito en el límite HTTP. No se copiaron archivos de aplicación del backend ni se modificó la rama `Back-end`.

El adaptador:

- acepta el contrato nativo del frontend y el fingerprint conocido de la rama `Back-end`;
- continúa rechazando cualquier fingerprint desconocido;
- convierte estados `financial.*` recibidos en estados neutrales `data.*` antes de validar y renderizar;
- convierte estados `data.*` a la forma esperada por el backend cuando se envía una edición de UI;
- elimina únicamente formatos de canales de visualización que el esquema actual del backend no admite;
- conserva formatos válidos de métricas, tablas y bindings;
- limita profundidad y cantidad de valores durante la adaptación y evita contaminación de prototipo;
- mantiene identidad de sesión, correlación, secuencia y revisiones.

### Archivos modificados

```text
src/features/integration/contracts/backend-contract-compatibility.ts
src/features/system-status/system-status-client.ts
src/features/agent/server/agent-stream-protocol.ts
src/features/agent/server/agent-api-client.ts
src/app/api/system/status/route.ts
scripts/integration-handshake.test.ts
scripts/int-01-backend-contract-compatibility.test.ts
package.json
```

### Validación

- `pnpm int-01:verify`: 11/11 pruebas aprobadas.
- `pnpm protocol:verify`: 5/5 pruebas aprobadas.
- `pnpm front-02:verify`: 28/28 pruebas aprobadas.
- `pnpm typecheck`: aprobado.
- `pnpm build`: aprobado.
- Backend directo `/api/system/status`: HTTP 200.
- Proxy del frontend `/api/system/status`: HTTP 200.
- `/conversar`: HTTP 200.
- La salida adaptada fue validada contra el `dist` contractual real de la rama `Back-end`.
- La rama `Back-end` permaneció limpia y sin modificaciones.

El sistema reporta `degraded` de forma correcta mientras Gemini y Supabase no estén configurados. Este estado ya no se confunde con una caída del backend ni con una incompatibilidad desconocida.

## Siguiente fase

### INT-02 — Semántica cívica del runtime GenUI

Objetivo: retirar la semántica financiera restante del runtime y adoptar los estados cívicos definitivos:

```text
financial.positive -> trend.increase
financial.negative -> trend.decrease
financial.neutral  -> evidence.neutral
financial.warning  -> evidence.caution
```

También incluye generalizar formateadores y máscaras, retirar fixtures financieros del flujo electoral y crear componentes propios para fuente, metodología y advertencias. El backend continuará siendo de sólo lectura.
