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

## INT-02 — Semántica cívica del runtime GenUI

**Estado: terminada.**

### Cambios realizados

El contrato y el runtime del frontend adoptaron los estados cívicos definitivos:

```text
financial.positive -> trend.increase
financial.negative -> trend.decrease
financial.neutral  -> evidence.neutral
financial.warning  -> evidence.caution
```

La terminología `financial.*` se conserva exclusivamente en el adaptador del límite HTTP para comunicarse con la rama `Back-end`. No se propaga al estado, contrato ni renderizado interno del frontend.

Además:

- se generalizaron colores, métricas, badges, gráficas, formateadores y el fallback de degradación;
- `currency` continúa disponible como formato genérico del protocolo, pero no se usa en el fixture INE;
- la máscara neutral protege también `claveElector`, `electorId` y `seccionElectoral` sin ocultar agregados como lista nominal;
- se añadieron `SourceNotice` y `MethodologyNotice` con semántica accesible;
- se creó `ine-participation-fixture.ts` como contrato sin cifras embebidas: los datos deben venir del Data Engine o de un dataset sintético rotulado en el harness;
- se retiraron los fixtures F5, F6 y F7, sus harnesses financieros y sus scripts exclusivos;
- se regeneró el fingerprint contractual del frontend y se mantuvo la compatibilidad explícita con el fingerprint actual del backend;
- la rama `Back-end` permaneció limpia y sin modificaciones.

### Archivos principales

```text
packages/contracts/src/generative-ui/schemas/content-node.ts
src/features/integration/contracts/backend-contract-compatibility.ts
src/features/generative-ui/fixtures/ine-participation-fixture.ts
src/features/generative-ui/primitives/content/SourceNotice.tsx
src/features/generative-ui/primitives/content/MethodologyNotice.tsx
src/features/generative-ui/data-binding/formatting/format-data-value.ts
src/features/generative-ui/data-binding/formatting/mask-sensitive-identifier.ts
src/features/generative-ui/degradation/build-generic-ui.ts
src/shared/design-system/semantic-color.ts
src/shared/design-system/tokens/colors.css
scripts/int-02-civic-runtime.test.ts
```

### Validación

- `pnpm int-02:verify`: 5/5 pruebas aprobadas.
- `pnpm int-01:verify`: 11/11 pruebas aprobadas contra el contrato real del backend.
- `pnpm front-02:verify`: regresión completa aprobada.
- `pnpm quality:verify`: 7/7 pruebas cívicas de seguridad y accesibilidad aprobadas.
- `pnpm typecheck`: aprobado.
- `pnpm build`: aprobado; las rutas financieras F5/F6/F7 ya no aparecen en el build.
- `git status` de la rama `Back-end`: limpio.

## INT-03 — Harness de participación INE

**Estado: terminada.**

### Cambios realizados

Se creó `/dev/ine-participation-harness` como laboratorio aislado de la navegación pública. El harness:

- muestra título narrativo y resumen ciudadano;
- compara participación 2009 y 2024 con diferencia en puntos porcentuales;
- presenta gráfica y tabla accesible con personas que votaron y lista nominal;
- permite ordenar las columnas desde el encabezado de la tabla;
- filtra por escenario nacional, Entidad Alfa y Entidad Beta;
- aplica las ediciones “Quita la gráfica” y “Deja sólo la tabla”;
- conserva un historial acotado y recupera la vista anterior;
- anuncia cambios mediante una región `aria-live`;
- incluye fuente, metodología y advertencias propias;
- usa controles nativos y mantiene navegación con teclado;
- responde en móvil y escritorio sin mezclar el harness con las rutas productivas.

Los valores viven únicamente en el harness de desarrollo y se identifican como **datos sintéticos de prueba**. Usan una base ficticia de 100 personas para hacer visible el cálculo y nunca se atribuyen al INE. El fixture contractual productivo de INT-02 continúa sin cifras embebidas.

### Archivos principales

```text
src/app/dev/ine-participation-harness/page.tsx
src/app/dev/ine-participation-harness/INEParticipationProbe.tsx
src/app/dev/ine-participation-harness/participation-harness-model.ts
src/app/dev/ine-participation-harness/page.module.css
scripts/int-03-participation-harness.test.ts
package.json
```

### Validación

- `pnpm int-03:verify`: 6/6 pruebas aprobadas.
- `pnpm int-02:verify`: 5/5 regresiones aprobadas.
- `pnpm quality:verify`: 7/7 pruebas de seguridad y accesibilidad aprobadas.
- `pnpm typecheck`: aprobado.
- `pnpm build`: aprobado y la ruta aparece en el manifiesto de producción.
- Prueba visual en vivo: filtro, ordenamiento disponible, eliminación de gráfica, modo sólo tabla y recuperación aprobados.
- `/dev/ine-participation-harness`: HTTP 200.
- Backend `/api/system/status`: HTTP 200 y repositorio sin modificaciones.

## Siguiente fase

### INT-04 — Adaptadores de las cuatro tools cívicas

Leer, sin modificar, los contratos reales de `get_participation_summary`, `compare_elections`, `get_participation_breakdown` y `get_supporting_records`. En el frontend se documentarán sus payloads y se crearán adaptadores validados para numerador, denominador, porcentaje, periodo, entidad, fuente, metodología, advertencias y respuestas parciales. Ningún campo ausente se completará con cifras inventadas.
