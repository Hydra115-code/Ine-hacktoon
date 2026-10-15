# Checklist DATA-01: seis cortes

Esta checklist cubre 2009, 2012, 2015, 2018, 2021 y 2024, con salida de entidad × año × sexo × 18 bandas de edad × tipo de sección. El inspector recorrió 54,872,712 filas de los 192 CSV y produjo 20,755 grupos; un lector independiente corroboró la entrada y comparó todos los agregados y el fixture. Los primeros ocho puntos están cerrados con esa evidencia. El noveno conserva su formulación original y se evalúa parcialmente: la ausencia de identificadores directos no permite certificar anonimato completo.

- [x] Identificar archivos oficiales.
- [x] Registrar URL y fecha efectiva de adquisición de los seis cortes.
- [x] Documentar columnas originales.
- [x] Detectar valores faltantes en las 16 columnas de todos los CSV.
- [x] Detectar nombres inconsistentes y comparar las seis publicaciones.
- [x] Documentar codificación mediante validación completa.
- [x] Crear muestra reproducible con los seis cortes.
- [x] Añadir checksum y comprobar la regeneración.
- [ ] Confirmar que no existen datos personales

## Evidencia y criterio de cierre por punto

| Punto | Criterio de cierre | Evidencia |
| --- | --- | --- |
| Archivos oficiales | Seis enlaces descubiertos en el landing INE, un ZIP por año, 32 CSV y un TXT por archivo; las seis descargas completas coincidieron con SHA-256 del catálogo. La disponibilidad HEAD se distingue de la posterior comprobación de bytes. | `data/ccpc/sources.json`, [fuentes](data-sources.md), `download-data.ts`. |
| URL y fecha | URL solicitada/final, bytes, hash y fecha efectiva de las nuevas descargas. Para los archivos locales previos se declara fecha histórica desconocida. No se deduce del mtime ni de Last-Modified. | `raw/downloads.json`; `sample/provenance.json`: `sources[].downloaded_at` y `download_record`. |
| Columnas originales | 16 columnas comunes descritas; seis TXT originales preservados, incluidos los cinco idénticos. Diferencias de categoría y marco documentadas. | [Diccionario](data-dictionary.md), `sample/dictionary-{año}.txt`. |
| Faltantes | Perfil de las 16 columnas de todas las filas. DEF/DEL: 28,477 casos solo espacios por columna en 2009 y 15,677 en 2012; DEL: 20,912 vacíos literales en 2024. Los demás casos de ausencia fueron cero. No se perdieron filas ni se confundió NS o cero con faltantes. | `sources[].missing_values`, `sources[].members[].missing_values`, [tabla](data-dictionary.md#faltantes). |
| Nombres inconsistentes | Se compararon los seis cortes por EDOCVE. Único cambio: clave 09 DISTRITO FEDERAL en 2009-2018 a CIUDAD DE MEXICO en 2021-2024. Sin conflictos dentro del corte ni espacios exteriores en EDONOM; etiquetas conservadas. | `sources[].names`, `entity_name_comparison`, [diccionario](data-dictionary.md#nombres). |
| Codificación | UTF-8 estricto de los 192 CSV y seis TXT. CSV 2009-2021 sin BOM/LF; CSV 2024 con BOM/CRLF; seis TXT sin BOM/LF. Separador coma y encabezado común de 16 columnas validados. | `sources[].members[].encoding`, `sources[].dictionary_encoding`. |
| Muestra reproducible | Fixture de 150 grupos completos, seis años presentes y selección determinista sin cruces artificiales; 13,546 bytes. Selección corroborada independientemente y regeneración exacta desde el agregado con entrada original e inversa. | `sample/entidad.csv`, `sample/provenance.json`: `fixture`; [evidencia](acceptance-evidence.json) y [README de datos](../data/ccpc/README.md). |
| Checksum | Hash de seis ZIP, 192 CSV, seis TXT y ocho archivos reducidos; listado del fixture comprobado. Regeneración conserva CSV y diccionarios; el timestamp de auditoría del JSON se trata por separado. Hash fixture: `e8319aa4f5577a3de5e768df04775812a9f71427d1e2fdfac03a10902484c2e9`. | `sources.json`, `sources[].members[].sha256`, `dictionary_sha256`, `sample/checksums.sha256`, [evidencia](acceptance-evidence.json). |
| Datos personales: evaluación parcial, con reserva | Encabezado original y contrato reducido sin campos nominativos o identificadores personales directos; salida sin municipio, distrito o sección. Se observan celdas agregadas LN=1: no se confirma la afirmación general de ausencia de datos personales ni anonimato absoluto. Se mantienen íntegros los conteos, sin supresión ni imputación. | [Alcance de la revisión](data-dictionary.md#alcance-de-la-revisión-de-datos-personales), encabezado de `sample/entidad.csv`, tabla de celdas pequeñas y controles del producto generado. |

Las rutas `raw/`, `sample/` y `sources.json` son relativas a `data/ccpc/`. El informe completo local se guarda en `data/ccpc/processed/inspection.json`. Los scripts se encuentran en `scripts/ccpc/`.

## Reproducir la aceptación

Desde la raíz del módulo, con Node.js `^22.18.0 || >=23.6.0`:

```powershell
npm ci
npm run ccpc:download -- --year all
npm run ccpc:inspect -- --year all --sample
npm run typecheck
npm test
```

La inspección final terminó con código cero, fuentes de los seis años, 32 entidades por corte, 192 CSV y seis TXT. Acreditó esquema, categorías, enteros seguros no negativos, unicidad cruda, `LN=SV+NV+NS`, conservación al agregar y cobertura íntegra de los perfiles de calidad. La comparación de nombres indica los seis años realmente evaluados; una ejecución parcial no reproduce ese alcance. `npm test` pasó 47/47 pruebas y `npm run typecheck` terminó con código cero en Node.js 24.14.1.

Las referencias oficiales se cotejan con filtros y universo compatibles. Para 2009-2021 se contrasta la tasa nacional redondeada a un decimal; el manual no aporta allí conteos exactos independientes. Para 2024 se cotejan conteos nacionales y de Aguascalientes de la p. 16. Los porcentajes se calculan después de sumar, y un denominador cero produce nulo.

Los resultados de filas, faltantes, formatos, nombres y huellas constan en los informes completos y la [evidencia de aceptación](acceptance-evidence.json). Los conteos de los 20,755 grupos y las 150 filas seleccionadas se contrastaron independientemente sin discrepancias. Un hallazgo documentado, como DEL vacío o cambio histórico de etiqueta, no se oculta para cerrar un punto; el cierre significa detectarlo y tratarlo conforme al contrato. Los primeros ocho puntos están cerrados. El noveno permanece parcialmente evaluado y sin marcar completo: no se rebaja su afirmación original para convertirla en un cumplimiento absoluto.

La auditoría independiente completa de los seis cortes observó celdas pequeñas en la misma agregación de entidad:

| Corte completo auditado | Grupos con LN=1 | Grupos con LN entre 1 y 4 |
| --- | ---: | ---: |
| 2009 | 3 | 8 |
| 2012 | 7 | 19 |
| 2015 | 5 | 18 |
| 2018 | 2 | 14 |
| 2021 | 2 | 7 |
| 2024 | 35 | 58 |
| Total completo | 54 | 124 |
| Fixture de 150 filas | 4 | 9 |

Las cuentas LN=1 están incluidas en las cuentas LN de 1 a 4. La tabla acredita una reserva concreta sobre celdas pequeñas en los seis cortes. El dato se conserva íntegro y esta entrega no aplica supresión ni imputación.

## Límites

La aceptación corresponde a DATA-01 de entidad y no acredita una ampliación DATA-02 ni integración de backend. No demuestra equivalencia de cartografía en niveles inferiores ni autoriza sumar el fixture al conjunto completo. Ausencia de identificadores directos no es certificación general de anonimato: se conservan las cautelas de celdas pequeñas y una publicación con mayor detalle requiere evaluación de exposición.
