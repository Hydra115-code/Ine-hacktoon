# DATA-03: consultas puras del Data Engine

El repositorio y el servicio operan sobre un snapshot de DATA-02 y no leen archivos, llaman a Gemini, acceden a red ni consultan el reloj. Los filtros y las salidas se validan con Zod real, fijado en `zod@4.6.7`. Las cuatro funciones son síncronas y pueden envolverse como tools MCP desde el backend sin delegar cálculos al modelo.

## Integración y límite de confianza

```typescript
import { validateFile } from '../scripts/ccpc/validate-data.ts';
import { createParticipationRepository } from './repositories/participation.repository.ts';
import { createParticipationService } from './services/participation.service.ts';

// Capa de carga del backend: verifica bytes, catálogo y referencias DATA-01.
const validated = await validateFile('data/ccpc/processed/data02/participation.json');
const repository = createParticipationRepository(validated);
const engine = createParticipationService(repository);

engine.getParticipationSummary({ year: 2024, entityCodes: ['06'] });
engine.compareElections({ entityCodes: ['06'] }, [2018, 2024]);
engine.getParticipationBreakdown({ year: 2024 }, 'sex');
engine.getSupportingRecords({ year: 2024, entityCodes: ['01'], sexes: ['hombre'], ageGroups: ['18-19'], sectionTypes: ['urbana'] });
```

`createParticipationRepository` valida el contrato en runtime y crea una copia defensiva e inmutable; por sí solo no vuelve a comprobar archivos o su autenticidad. Por eso la evidencia declara `validation: 'runtime_schema'`. La carga externa debe usar `validateFile` u otra frontera con la misma verificación. No se debe insertar JSON propuesto por un modelo y presentarlo como una fuente oficial verificada.

El puerto `ParticipationDataPort` expone metadatos y selección de registros/fuentes. Esto permite otro adaptador de almacenamiento que respete el mismo contrato. El servicio depende del puerto; no contiene lógica de lectura de ZIP, almacenamiento o transporte MCP. El registro de herramientas, autenticación y paginación de transporte corresponden al backend.

## Filtros y reglas temporales

`ParticipationFilters` acepta exclusivamente `year`, `entityCodes`, `sexes`, `ageGroups` y `sectionTypes`. Las listas son OR dentro de una dimensión y las dimensiones se combinan mediante AND. Las listas vacías o duplicadas, claves de entidad fuera de 01–32, años no catalogados y campos desconocidos —incluidos municipio/distrito/sección— producen error. No se convierten cadenas de año a números.

Las listas se copian y ordenan por el dominio sin modificar la entrada. Año: 2009, 2012, 2015, 2018, 2021 o 2024. Sexo: hombre, mujer, no_binario. Edad: las 18 bandas de DATA-02, con 100+ abierto. Tipo de sección: urbana, mixta o rural.

Resumen, desglose y soporte usan un solo año. Si se omite, eligen el último año disponible del snapshot; lo escriben en `filters.year` y añaden `DEFAULT_YEAR_SELECTED`. Un dataset parcial puede tener un último año diferente de 2024. `getParticipationBreakdown(..., 'year')` conserva esta regla y produce el grupo del año elegido; la consulta para varias elecciones es `compareElections`.

`compareElections(filters, years)` exige entre dos y seis años únicos catalogados. Ordena una copia cronológicamente, usa el primero como base y devuelve N−1 cambios. Rechaza `filters.year` para evitar ignorarlo o sobrescribirlo. Cada elección tiene un resumen separado; no se suman las listas nominales de años distintos como si fueran una única elección.

## Salidas y evidencia

Los esquemas exportados desde `src/application/ports/participation-data.ts` son `participationSummarySchema`, `electionComparisonSchema`, `participationBreakdownSchema` y `supportingRecordsSchema`. El servicio ejecuta `.parse` antes de devolver cada salida. También se exportan `participationFiltersSchema`, `Evidence` y los tipos de resultados.

Cada respuesta incluye:

- `query`, filtros aplicados y `status`.
- `units`: razones, porcentajes, puntos porcentuales y ambos denominadores.
- `evidence.dataset`: versión, alcance full/sample, años disponibles y hash de todos los registros del snapshot.
- `evidence.recordsSha256`: hash de los registros efectivamente seleccionados, con JSON canónico compatible con DATA-02.
- `matchedRecords`, `matchedSourceRows` y `contributions` por fuente. Las filas originales no equivalen a personas: cada fila cruda puede contener un conteo LN mayor que uno.
- `sources`: contexto de archivos del año/entidad, con URL, hashes ZIP/CSV/diccionario, adquisición y totales originales. Sus totales corresponden al archivo completo, no al subconjunto filtrado; el resultado filtrado está en `totals`.
- `catalogSources`: referencia oficial de cada año solicitado. Si un año no está cargado, se conserva esa URL sin inventar hashes o archivos locales.
- `warnings`: mensajes deterministas con códigos estables.

Una selección sin registros tiene `status: 'no_data'`, `totals: null` en el resumen y listas vacías en soporte/desglose. No se presentan porcentajes cero. Se conserva el contexto de fuente si está cargado. Un registro observado con LN=0 es otro caso: su estado es `ok`, sus conteos son cero y sus métricas indefinidas son nulas.

Los desgloses admiten `entity`, `year`, `sex`, `ageGroup` y `sectionType`. Sus grupos conservan los conteos y filas del conjunto seleccionado; cada grupo tiene un resumen con su evidencia. Los grupos ausentes no se rellenan artificialmente.

## Cálculos y comparabilidad

Se suman los cuatro conteos y después se calculan las tasas. Las razones `participationRate` y `abstentionRate` usan LN; `*Pct` son porcentajes 0–100; `ccpc*Pct` usan SV+NV. NS se conserva separado de NV. Un denominador cero da `null` y las sumas fuera del rango entero seguro fallan explícitamente.

En comparaciones, los campos `*PercentagePoints` usan puntos porcentuales; `participationRelativePercent` usa variación relativa en porcentaje y da `null` con base cero o resultado ausente. No se intercambian las dos unidades.

| Código | Condición y significado |
| --- | --- |
| `SAMPLE_DATA` | El snapshot es la muestra; las sumas no representan el universo estatal/nacional. |
| `DEFAULT_YEAR_SELECTED` | Se eligió el último año disponible por omisión. |
| `YEAR_NOT_AVAILABLE` | El año permitido no está en el dataset cargado. |
| `NO_MATCHING_RECORDS` | No existen grupos observados para los filtros; no equivale a cero. |
| `NON_BINARY_UNAVAILABLE` | Se solicitó no_binario para un año anterior a 2024; no se inventa esa categoría. |
| `NS_EXCLUDED_FROM_CCPC` | Hay NS y los dos universos de cálculo deben distinguirse. |
| `ELECTIONS_NOT_A_PANEL` | Elecciones distintas no constituyen un panel de las mismas personas ni una prueba causal. |
| `CARTOGRAPHIC_FRAMES_DIFFER` | Se compara 2024 con cortes anteriores: los TXT describen DERFE 2023 frente a 2021. |
| `SECTION_TYPES_MAY_CHANGE` | El filtro de tipo de sección no garantiza las mismas secciones entre esos marcos. |
| `SEX_CATEGORIES_CHANGED` | Una comparación con 2024 incluye todas las categorías o no_binario. |
| `ENTITY_LABEL_CHANGED` | Una clave conserva etiquetas históricas diferentes; se une por clave INE. |
| `SMALL_CELLS` | Algún grupo seleccionado tiene LN entre 1 y 4; no se certifica anonimato absoluto. |

La comparación geográfica sigue limitada a entidad. No se implementan cruces por municipios, distritos o secciones. La reserva de privacidad de DATA-01 sigue vigente, incluso al consultar el soporte.

## Ejecutar y reproducir ejemplos

```powershell
npm ci
npm run typecheck
npm test
npm run ccpc:queries
```

El último comando carga y valida el fixture DATA-02 y escribe los cuatro ejemplos en `docs/data03-examples/sample/queries.json`, con checksum. Para reproducir los ejemplos del conjunto completo, una vez generado DATA-02:

```powershell
npm run ccpc:queries -- --input data/ccpc/processed/data02/participation.json
```

Escribe `docs/data03-examples/full/queries.json`. El adaptador de ejemplos contiene el I/O; no forma parte de las funciones puras. Los ejemplos no llevan reloj, ruta del equipo o datos producidos por Gemini.

Las fuentes de la metodología se mantienen en [DATA-01](data-sources.md). API de validación: [documentación oficial Zod](https://zod.dev/basics). Estado y hechos ejecutados: [checklist DATA-03](data03-checklist.md).
