# Integrar DATA-01, DATA-02 y DATA-03 en el proyecto

Esta carpeta es un módulo independiente de datos CCPC. Contiene fuentes y referencias, inspección, ETL, validación, fixtures, cuatro consultas puras y pruebas. El equipo puede usar la muestra incluida desde el primer día y regenerar el conjunto completo por separado. No instala ni publica un servidor MCP: el registro de tools, transporte, autenticación y despliegue corresponden al backend.

## Requisitos y alcance

- Node.js `^22.18.0 || >=23.6.0`, según `package.json`, y npm. La evidencia histórica registra Node 24.14.1; Node 24 es una opción adecuada para trabajar en equipo.
- El módulo es ESM (`"type": "module"`) y ejecuta TypeScript directamente con Node. Conserva las extensiones `.ts` de los imports. No requiere un build previo ni una clave de Gemini.
- TypeScript usa `NodeNext`, `strict`, `allowImportingTsExtensions` y `erasableSyntaxOnly`. Ejecutar `npm run typecheck` además de las pruebas: la ejecución nativa de TypeScript no comprueba los tipos.
- Dependencias: `csv-parse`, `yauzl` y Zod real; las versiones instalables están fijadas en `package-lock.json`.
- Alcance: **entidad × año × sexo × grupo de edad × tipo de sección**, para 2009, 2012, 2015, 2018, 2021 y 2024. `sectionType` es urbana/mixta/rural; no es una clave de sección. No hay consultas municipales, distritales o seccionales.

## Ruta A: desarrollar con la muestra, sin descargar ZIP

Desde la raíz de esta carpeta:

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run ccpc:validate -- --input data/ccpc/sample/data02/participation.json
npm run ccpc:queries
```

Esta ruta no solicita datos al INE. `npm ci` necesita acceso al registro npm, salvo que las dependencias ya estén disponibles en la caché; después, las pruebas, la validación del fixture y las consultas no necesitan red. No se necesitan los ZIP originales, datos completos ni credenciales de un modelo.

La muestra contiene 150 grupos reales íntegros seleccionados y sus referencias de origen. No contiene el universo nacional ni el de todas las entidades. Los resultados incluyen `evidence.dataset.kind: 'sample'` y el aviso `SAMPLE_DATA`. La UI debe mostrar que son datos de desarrollo; sus sumas no deben presentarse como cifras estatales o nacionales completas.

`ccpc:queries` valida la muestra y genera las entradas y salidas de las cuatro consultas en `docs/data03-examples/sample/queries.json`, junto con `checksums.sha256`.

## Ruta B: regenerar y usar los seis cortes completos

Desde la misma raíz, con conexión al INE para la descarga:

```powershell
npm ci --ignore-scripts
npm run ccpc:download -- --year all
npm run ccpc:inspect -- --year all --sample
npm run ccpc:pipeline
npm run ccpc:validate -- --input data/ccpc/sample/data02/participation.json
npm run ccpc:queries -- --input data/ccpc/processed/data02/participation.json
npm run typecheck
npm test
```

El orden es importante:

1. La descarga obtiene los seis ZIP de `data/ccpc/sources.json`, verifica firma y SHA-256 y registra adquisición en `data/ccpc/raw/downloads.json`.
2. La inspección genera `data/ccpc/processed/entidad.csv` y `inspection.json`, y actualiza el fixture DATA-01 y su procedencia. El CSV completo es una referencia que requiere el validador DATA-02.
3. `ccpc:pipeline` normaliza los seis ZIP, genera la muestra DATA-02 y valida el conjunto completo. Equivale a `npm run ccpc:normalize -- --year all --sample` seguido de `npm run ccpc:validate`.
4. La consulta completa usa `data/ccpc/processed/data02/participation.json` y escribe ejemplos en `docs/data03-examples/full/`.

Los ZIP y los datos procesados quedan fuera de Git mediante `.gitignore`. La publicación auditada produjo 20,755 grupos y 192 fuentes; no se incluyen esos archivos pesados en la entrega de código. La disponibilidad futura del servidor oficial no se presupone: un fallo de descarga o un cambio de hash debe revisarse, no resolverse desactivando la validación.

Si ya se tienen los ZIP, el inspector y el normalizador aceptan `--zip-2009 PATH`, `--zip-2012 PATH`, `--zip-2015 PATH`, `--zip-2018 PATH`, `--zip-2021 PATH` y `--zip-2024 PATH`. Se deben pasar las mismas rutas a **ambos** comandos; `ccpc:pipeline` utiliza las rutas predeterminadas de `data/ccpc/raw/`. La fecha histórica desconocida de un ZIP local se conserva como desconocida; no se obtiene de su fecha de modificación.

La inspección registra una nueva fecha de auditoría y una descarga nueva cambia metadatos de adquisición. Esas entradas pueden modificar hashes de procedencia y ejemplos; no significan que hayan cambiado los conteos. Los datos y el ETL son deterministas para los mismos archivos y metadatos de entrada. No editar manualmente fixtures, anclas o checksums para hacer pasar una validación.

## Ejemplo ejecutable de carga y las cuatro consultas

Este comando PowerShell se ejecuta desde la raíz del módulo, después de `npm ci`. No crea archivos ni necesita un servidor. La entrada predeterminada es la muestra incluida:

```powershell
@'
import { validateFile } from './scripts/ccpc/validate-data.ts';
import { createParticipationRepository } from './src/repositories/participation.repository.ts';
import { createParticipationService } from './src/services/participation.service.ts';
import { participationFiltersSchema } from './src/application/ports/participation-data.ts';

const input = process.argv[2] ?? 'data/ccpc/sample/data02/participation.json';
const dataset = await validateFile(input);
const repository = createParticipationRepository(dataset);
const engine = createParticipationService(repository);
const filters = participationFiltersSchema.parse({
  year: 2024,
  entityCodes: ['01'],
  sexes: ['hombre'],
  ageGroups: ['18-19'],
  sectionTypes: ['urbana'],
});
const { year, ...comparisonFilters } = filters;

console.log(JSON.stringify({
  summary: engine.getParticipationSummary(filters),
  comparison: engine.compareElections(comparisonFilters, [2018, 2024]),
  breakdown: engine.getParticipationBreakdown({ year: 2024, entityCodes: ['01'] }, 'sex'),
  supportingRecords: engine.getSupportingRecords(filters),
}, null, 2));
'@ | node --input-type=module -
```

Para ejecutar el mismo bloque sobre el conjunto completo ya regenerado, sustituir su última línea por:

```powershell
'@ | node --input-type=module - data/ccpc/processed/data02/participation.json
```

La selección AGS/2024/hombre/18–19/urbana está incluida en la muestra y corresponde a un grupo completo: LN 14,908; SV 7,288; NV 7,297; NS 323; 1,025 filas originales contribuyentes. Eso permite contrastar una cifra real sin confundir la muestra con un total nacional.

`validateFile` es la frontera de carga: verifica esquema, manifiesto, checksums, catálogo y referencias de DATA-01. Debe ejecutarse antes de inyectar un archivo en el motor. `createParticipationRepository` comprueba el contrato en runtime y crea un snapshot inmutable; no vuelve a auditar los bytes de archivos ni acredita por sí solo su autenticidad. Por eso la evidencia del repositorio declara `validation: 'runtime_schema'`.

En el backend, cargar y validar una vez al iniciar o al actualizar explícitamente el dataset, crear el snapshot y reutilizar el servicio. Mantener la lectura de disco fuera de cada función pura. Si falla la carga, detener esa publicación de datos y comunicar el error; no cambiar silenciosamente a la muestra ni devolver porcentajes cero.

## Contrato para backend y UI

Los filtros admiten `year`, `entityCodes`, `sexes`, `ageGroups` y `sectionTypes`. Los tipos y esquemas se exportan desde `src/application/ports/participation-data.ts`. Las listas combinan OR dentro de una dimensión y AND entre dimensiones. Las claves de entidad son cadenas de dos dígitos (`'01'` a `'32'`); el año es numérico. Campos desconocidos, listas vacías o repetidas y valores fuera del dominio fallan explícitamente.

Resumen, desglose y soporte usan un solo año. Si se omite, seleccionan el último año del snapshot y lo declaran en `filters.year`, con `DEFAULT_YEAR_SELECTED`. Para una UI con selector de elección, pasar siempre el año elegido. `getParticipationBreakdown(..., 'year')` conserva esa regla; para varias elecciones usar `compareElections` con entre dos y seis años únicos y **sin** `filters.year`. La comparación ordena los años y usa el primero como base.

| Campo / comportamiento | Cómo consumirlo |
| --- | --- |
| `nominalList`, `voted`, `didNotVote`, `unspecified` | Conteos LN, SV, NV y NS. NS es participación no especificada y permanece separada de abstención. |
| `participationRate`, `abstentionRate` | Razones 0–1: SV/LN y NV/LN. No añadir `%` a esos valores sin convertir su unidad. |
| `participationPct`, `abstentionPct` | Porcentajes nominales 0–100. |
| `ccpcParticipationPct`, `ccpcAbstentionPct` | Porcentajes oficiales sobre SV+NV; excluyen NS del denominador. Etiquetar el indicador elegido. |
| `*PercentagePoints` | Diferencia entre porcentajes expresada en puntos porcentuales. |
| `participationRelativePercent` | Variación relativa porcentual respecto del año base; es otra unidad. |
| `status: 'no_data'` | No hay grupos observados: resumen con `totals: null` y listas vacías en desglose/soporte. Mostrar ausencia de datos, no un valor cero. |
| Métrica `null` con un grupo observado | Denominador cero: mostrar no definida. Los conteos observados pueden ser cero. |
| `warnings` | Conservar los códigos y presentar las advertencias relevantes junto al resultado. |

Primero se suman conteos y después se calculan porcentajes. La UI o una tool no debe promediar porcentajes de filas, sumar universos de elecciones distintas ni recalcular con un denominador implícito. Redondear únicamente para presentación, conservando los valores originales de la respuesta.

Cada salida ya pasa por Zod y contiene `evidence` y `units`. Conservar al menos la URL oficial, año, filtros aplicados, alcance full/sample y advertencias visibles en la experiencia; mantener la evidencia completa disponible para el soporte o la descarga del resultado. `evidence.sources[].totals` corresponde al archivo original completo; el resultado filtrado está en `totals`. `matchedSourceRows` cuenta filas originales contribuyentes, no personas. Los hashes identifican el snapshot y la selección exacta.

Para varias elecciones, mostrar sus advertencias de comparabilidad: universo distinto, marcos cartográficos, cambios de nombres/categorías y tipos de sección. `no_binario` solo está documentado para 2024; solicitarlo antes de 2024 produce ausencia de datos, no ceros inventados. Las elecciones no constituyen un panel de las mismas personas ni una prueba causal.

## Integrar en un repositorio existente

La opción más directa es incorporar esta carpeta como subdirectorio de datos y ejecutar los comandos desde ella. Si el equipo prefiere fusionarla con la raíz del backend:

1. Preservar las rutas relativas de `src/`, `scripts/ccpc/`, `data/ccpc/` y `docs/`, o adaptar y probar todos los imports y las referencias. Las CLI resuelven la raíz a partir de su archivo; mover solo algunos helpers rompe esa relación.
2. Conservar todo `scripts/ccpc/`, incluyendo `years.ts`, `validation.ts`, `model.ts`, `quality.ts`, `etl-io.ts` y `source-row-anchors.ts`; los cuatro scripts principales no son independientes de esos helpers.
3. Conservar `data/ccpc/sources.json`, `source-anchors.json` y los dos fixtures completos. El validador necesita el CSV, los diccionarios originales, procedencia y checksums DATA-01 incluso al validar el JSON DATA-02 reducido.
4. Combinar dependencias, scripts npm y configuración TypeScript con los del backend. No sobrescribir su `package.json`, lockfile o configuración existente a ciegas. Si cambian el runtime o el compilador, volver a ejecutar typecheck, pruebas y validación.
5. Incorporar las reglas `.gitignore` y `.gitattributes`. Mantener LF en los archivos con hashes fijados y los TXT originales sin conversión de texto. No introducir normalización automática de los diccionarios.
6. Versionar código, pruebas, catálogo, anclas, fixtures, documentación y evidencias. Mantener fuera del repositorio ZIP, `node_modules`, datos completos y archivos temporales. Un artefacto completo de despliegue puede almacenarse por un canal aparte con su manifiesto y hashes.
7. Añadir los comandos de validación a la CI del proyecto. La ruta con muestra es suficiente para que cada integrante empiece; la regeneración completa es una ejecución separada que requiere los archivos oficiales.

No reutilizar ni mezclar estos modelos con dominios financieros del backend. La integración MCP debe envolver los cuatro métodos, validar sus entradas con los esquemas compartidos y conservar la respuesta y su procedencia. Ningún modelo generativo debe producir los conteos o sustituir el cálculo del motor.

## Responsables y cierre recomendado

| Responsable | Entregable de integración | Criterio de cierre |
| --- | --- | --- |
| Encargado de datos | Catálogo, ZIP verificados, inspección, ETL, manifiestos y cambios de fuentes. | Pipeline completo válido; mismos datos de entrada producen los mismos datos de salida; un cambio oficial se audita antes de cambiar anclas. |
| Backend | Carga validada, snapshot, servicio y envoltorios HTTP/MCP del proyecto. | Las cuatro consultas conservan filtros, unidades, evidencia y errores; el entorno declara si usa muestra o conjunto completo. |
| Frontend / UI | Filtros, indicador seleccionado, estado sin datos, referencias y advertencias. | La muestra se identifica; null no se convierte en cero; se distinguen porcentajes y puntos porcentuales. |
| QA | Ejecución desde instalación limpia y casos positivos/negativos. | `npm run typecheck`, `npm test`, validación del fixture y cuatro ejemplos terminan correctamente; fallos no se ocultan. |

Las evidencias incluidas registran DATA-02 con 11/11 validaciones y DATA-03 con 7/7 puntos. DATA-01 mantiene **8/9 puntos cerrados y reserva de privacidad**: no se encontraron identificadores directos, pero existen celdas pequeñas; no se certifica anonimato absoluto. La validación numérica no cierra esa reserva ni autoriza afirmaciones adicionales sobre privacidad.

Revisar los detalles y hechos ejecutados en [fuentes](data-sources.md), [diccionario](data-dictionary.md), [checklist DATA-01](checklist.md), [contrato DATA-02](data02-contract.md), [checklist DATA-02](data02-checklist.md), [contrato DATA-03](data03-contract.md) y [checklist DATA-03](data03-checklist.md). Las evidencias históricas son registros de esas ejecuciones; los logs nuevos de CI documentan la instalación y los cambios del equipo.
