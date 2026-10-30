# Datos CCPC DATA-01

Catálogo y fixture reducido de los cortes 2009, 2012, 2015, 2018, 2021 y 2024. Los ZIP originales y el agregado completo son productos locales regenerables; no deben incorporarse al paquete de código.

```text
data/ccpc/
  sources.json                 # URL oficial y SHA-256 de los seis ZIP
  sample/
    entidad.csv                # grupos completos seleccionados del agregado
    dictionary-2009.txt         # bytes originales del miembro TXT de cada ZIP
    dictionary-2012.txt
    dictionary-2015.txt
    dictionary-2018.txt
    dictionary-2021.txt
    dictionary-2024.txt
    provenance.json            # procedencia y resultados de la inspección completa
    checksums.sha256           # huellas del CSV, JSON y seis diccionarios
  raw/                         # local: seis ZIP y downloads.json
  processed/                   # local: entidad.csv completo e inspection.json
```

## Regeneración

Desde la raíz del módulo, con Node.js `^22.18.0 || >=23.6.0`:

```powershell
npm ci
npm run ccpc:download -- --year all
npm run ccpc:inspect -- --year all --sample
npm run typecheck
npm test
```

La descarga obtiene los seis ZIP catalogados, comprueba el SHA-256 y guarda `downloads.json`. `downloaded_at` es la fecha efectiva UTC de una descarga terminada y verificada; `verified_at` es la comprobación más reciente. Una ejecución que reutiliza un ZIP válido conserva la fecha conocida y no inventa una fecha histórica para un archivo local sin procedencia. Ni la modificación local del archivo ni el encabezado HTTP Last-Modified se utilizan como fecha de adquisición.

El inspector acepta `--year all` o un año del catálogo. Permite las seis opciones `--zip-2009 PATH`, `--zip-2012 PATH`, `--zip-2015 PATH`, `--zip-2018 PATH`, `--zip-2021 PATH` y `--zip-2024 PATH`. Las rutas no indicadas usan `raw/`. `--sample` requiere `all` y todos los cortes, para que una ejecución parcial no reemplace el fixture conjunto.

## Productos y cobertura

Los ZIP aportan 32 CSV y un TXT por año. Cada CSV corresponde a una entidad; las filas originales conservan municipio, sección, sexo y edad. El agregado publica únicamente entidad, año, sexo, una de las 18 bandas de edad y tipo de sección. `tipo_seccion` es una categoría urbana, mixta o rural, no una clave territorial.

La entrega verificada comprende 54,872,712 filas originales, 192 CSV y 20,755 grupos agregados. El fixture contiene 150 filas y ocupa 13,546 bytes. Los primeros ocho puntos DATA-01 están cerrados; el noveno mantiene una evaluación parcial con reserva, según la [evidencia de aceptación](../../docs/acceptance-evidence.json).

`inspection.json` contiene el resultado completo: hashes de ZIP y miembros, filas por CSV/año, conteos, categorías observadas, faltantes de las 16 columnas, nombres de entidad, codificación, controles de calidad y contraste oficial. `sample/provenance.json` conserva esos resultados de origen junto con la selección y la huella del fixture. Tener muchas filas de origen en la procedencia no convierte el pequeño fixture en el conjunto completo.

La selección determinista toma la primera entidad disponible, en el orden definido por el código, por año/sexo/tipo y bandas `18-19`, `20-24`, `60-64` y `100+`. Añade casos NS positivo y denominador cero cuando existen en el agregado. Cada fila elegida conserva el agregado completo de su clave; no se toman primeras filas crudas para calcularla. La cobertura de una categoría depende de su presencia real y no se rellena con ceros.

Los seis diccionarios se preservan como bytes originales. Los TXT 2009-2021 son idénticos byte a byte en los ZIP inventariados; se conserva un ejemplar por corte para acreditar su procedencia individual. Los hashes se calculan sobre los bytes originales, antes de interpretar BOM o normalizar etiquetas.

Un lector independiente reconstruyó los 20,755 grupos y comparó los cuatro conteos por clave, etiquetas, denominador y porcentajes de salida; no encontró discrepancias. También reprodujo la selección de las 150 filas. Se comprobó la regeneración exacta de los bytes del fixture usando el agregado completo y de nuevo con orden de entrada inverso. La comprobación final pasó 47/47 pruebas y el chequeo de TypeScript terminó con código cero.

## Cálculos y límites

Los 15 campos de salida y sus unidades están en el [diccionario](../../docs/data-dictionary.md). Primero se suman LN/SV/NV/NS; después se calculan las tasas sobre sus denominadores documentados. El CSV usa hasta seis decimales para los porcentajes y una celda vacía cuando el resultado es nulo. El JSON conserva el cálculo numérico sin ese redondeo de presentación.

El CSV agregado y los diccionarios deben regenerarse con las mismas huellas a partir de los mismos ZIP. La fecha `inspected_at` es metadato de la nueva inspección y puede cambiar legítimamente el JSON y su checksum. Por eso la reproducibilidad de los datos se comprueba por separado de la fecha de auditoría.

El esquema original no contiene campos de identificadores personales directos; el producto reducido omite municipio, distrito y sección. Eso no garantiza anonimato absoluto: se observaron 54 grupos con LN=1 y 124 con LN de 1 a 4 en el agregado completo; el fixture contiene 4 y 9, respectivamente. Las cuentas LN=1 están incluidas en LN de 1 a 4. Los datos de esta entrega permanecen íntegros, sin supresión ni imputación. El fixture es material de desarrollo; una publicación o API con mayor detalle deberá evaluar exposición y cruces externos antes de afirmar garantías más amplias.

Consulte [fuentes](../../docs/data-sources.md) para el universo y la cartografía, y [checklist DATA-01](../../docs/checklist.md) para el estado de esa etapa. La ampliación DATA-02 publica JSON y manifiestos en `processed/data02/` y `sample/data02/`; su [contrato](../../docs/data02-contract.md) y [checklist](../../docs/data02-checklist.md) documentan la validación independiente.
