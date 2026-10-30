# DATA-02: ETL y validación CCPC 2009-2024

El ETL lee los seis ZIP oficiales completos y convierte sus conteos al contrato `ccpc-participation/v1`. Mantiene el alcance entidad × año × sexo × grupo de edad × tipo de sección. No importa ni reutiliza dominios financieros. La salida completa queda en `data/ccpc/processed/data02/`, excluida por `.gitignore`; el fixture de grupos completos queda en `data/ccpc/sample/data02/`.

## Reproducir

Desde la raíz del módulo, con Node.js `^22.18.0 || >=23.6.0`:

```powershell
npm ci
npm run ccpc:download -- --year all
npm run ccpc:inspect -- --year all --sample
npm run ccpc:pipeline
npm run ccpc:validate -- --input data/ccpc/sample/data02/participation.json
npm run typecheck
npm test
```

`ccpc:pipeline` ejecuta normalización de los seis cortes, genera el fixture y valida el conjunto completo. `ccpc:normalize` acepta `--year all|2009|2012|2015|2018|2021|2024`, `--zip-<año> PATH`, `--output DIR` y `--sample`. La muestra exige todos los años. Publicar datos completos dentro de `data/ccpc/sample/` falla antes de abrir los ZIP.

## Modelo y unidades

| Campos | Significado / unidad |
| --- | --- |
| `entityCode`, `entityName` | Clave INE de dos dígitos y nombre original observado en el corte. |
| `year`, `sex`, `ageGroup`, `sectionType` | Seis años permitidos; hombre/mujer y no_binario solo en 2024; 18 bandas desde 18-19 hasta 100+; urbana/mixta/rural. |
| `nominalList`, `voted`, `didNotVote`, `unspecified` | LN, SV, NV, NS; enteros seguros no negativos. |
| `classified` | `voted + didNotVote`. |
| `participationRate` | `voted / nominalList`, razón de 0 a 1. |
| `abstentionRate` | `didNotVote / nominalList`, razón de 0 a 1. |
| `unspecifiedRate` | `unspecified / nominalList`, razón de 0 a 1. |
| `participationPct`, `abstentionPct`, `unspecifiedPct` | Las razones anteriores multiplicadas por 100, porcentajes de 0 a 100. |
| `ccpcParticipationPct`, `ccpcAbstentionPct` | Indicadores oficiales: `100*voted/classified`, `100*didNotVote/classified`. |
| `sourceId`, `sourceRows` | Referencia al CSV de origen y número exacto de filas crudas que contribuyeron al grupo. |

La checklist expresa dos divisiones por lista nominal. Se conservan literalmente en los campos `*Rate` como razones; sus versiones `*Pct` cumplen el rango 0–100. Esto mantiene la decisión previa de conservar ambas métricas y hacer explícitas sus unidades. Los indicadores oficiales CCPC se guardan en campos distintos porque excluyen NS del denominador. No se interpreta NS como abstención.

Un denominador cero produce `null`. Con LN=0 todos los conteos deben ser cero; con LN>0 y todos los registros NS, las métricas nominales son definidas y las oficiales son nulas. Nunca se convierte un resultado indefinido en cero. Primero se agregan los conteos y luego se calculan las métricas; no se promedian porcentajes.

`metricDefinitions` declara `ratio`, `percent`, `percentage_point` y los dos denominadores. `percentagePointDifference(60,50)` produce 10 puntos porcentuales; `relativePercentageChange(60,50)` produce 20 %, y una base cero da cambio relativo nulo. Estas funciones reciben porcentajes; rechazan valores fuera de 0–100.

## Procedencia y validación

Cada fuente incluye año/entidad, URL oficial, SHA-256 del ZIP, del CSV y del diccionario, fecha de adquisición conocida o `null`, filas originales y los cuatro totales. La ausencia de fecha histórica no se sustituye por mtime ni por la fecha actual. Los registros preservan los nombres del CSV: Distrito Federal hasta 2018 y Ciudad de México desde 2021. Se conservan edades extremas en 100+ y todos los NS. Los blancos DEF/DEL detectados por DATA-01 no se imputan ni eliminan filas; esas dimensiones no forman parte del producto.

El esquema rechaza campos desconocidos, dimensiones de niveles inferiores, años/entidades/categorías no documentados, conteos no enteros o inseguros, numeradores mayores que LN, particiones incoherentes, tasas incorrectas, combinaciones repetidas, fuentes sin correspondencia, órdenes no canónicos y fallos de conservación. Un conjunto completo necesita 32 fuentes por año. La muestra conserva cada grupo íntegro y solo las fuentes utilizadas.

El validador comprueba esquema, manifiesto, checksums y catálogo. También contrasta con los metadatos verificados de DATA-01 y con sus conteos por grupo, fijados mediante SHA-256 independiente del manifiesto DATA-02. Un manifiesto regenerado después de modificar SV/NV no acredita esos nuevos conteos. Para un conjunto completo se necesita el CSV integral de DATA-01; para una muestra se utiliza su CSV reducido. Una referencia ausente o con huella diferente es un fallo explícito, no una validación parcial presentada como completa.

`data/ccpc/source-anchors.json` contiene los hechos originales de las 192 fuentes y las huellas de ambos CSV; su hash está fijado en el validador y sus finales de línea son LF. `scripts/ccpc/source-row-anchors.ts` fija seis huellas de filas contribuyentes por grupo y una para la muestra, obtenidas con un lector separado de los ZIP originales. Estas anclas no se regeneran a partir de un resultado que se intenta validar. Cambiar una publicación oficial requiere auditar el nuevo corte y actualizar explícitamente esas anclas.

## Determinismo y fallos

El JSON se serializa con claves ordenadas y un orden fijo de registros y fuentes. Los archivos de datos y manifiesto no incluyen reloj actual, ruta del equipo ni identificadores aleatorios de ejecución. Los mismos ZIP, catálogo y metadatos de adquisición producen los mismos bytes. Una fecha nueva de adquisición es un cambio de metadatos de entrada; los conteos y métricas se comparan también por separado.

Todas las entradas seleccionadas y ambas salidas se validan antes de publicar. La función de publicación valida en runtime incluso cuando se invoca directamente, usa un bloqueo de directorio y conserva/restaura archivos ante errores de escritura. La CLI termina con código distinto de cero y un error identificable ante inconsistencias. Esta publicación por directorio no es una transacción global entre el conjunto completo y la muestra: un fallo de I/O en el segundo destino requiere volver a ejecutar el pipeline.

La evidencia ejecutada y el estado de los once puntos están en [checklist DATA-02](data02-checklist.md). La reserva de privacidad de [DATA-01](checklist.md) continúa vigente: el cumplimiento numérico no certifica anonimato absoluto ni autoriza exposición de celdas pequeñas.
