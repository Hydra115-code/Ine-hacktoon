# Fuentes CCPC DATA-01

Los seis cortes se identifican desde la [página oficial del INE](https://ine.mx/transparencia/datos-abiertos/visualizacion-datos/conteos-censales-participacion/), que enlaza sus ZIP y el [manual CCPC 2009-2024](https://ine.mx/wp-content/uploads/2025/06/Manual-Conteos-Censales-2009-2024.pdf). El catálogo ejecutable está en `data/ccpc/sources.json`; contiene URL, nombre de archivo y SHA-256 de referencia por año.

| Año | URL oficial exacta | Tamaño declarado por HEAD, bytes |
| --- | --- | ---: |
| 2009 | [DatosAbiertos_DECEyEC_ConteosCensales2009.zip](https://ine.mx/wp-content/uploads/2022/04/DatosAbiertos_DECEyEC_ConteosCensales2009.zip) | 40,203,573 |
| 2012 | [DatosAbiertos_DECEyEC_ConteosCensales2012.zip](https://ine.mx/wp-content/uploads/2022/04/DatosAbiertos_DECEyEC_ConteosCensales2012.zip) | 39,515,896 |
| 2015 | [DatosAbiertos_DECEyEC_ConteosCensales2015.zip](https://ine.mx/wp-content/uploads/2022/04/DatosAbiertos_DECEyEC_ConteosCensales2015.zip) | 42,594,136 |
| 2018 | [DatosAbiertos_DECEyEC_ConteosCensales2018.zip](https://ine.mx/wp-content/uploads/2022/04/DatosAbiertos_DECEyEC_ConteosCensales2018.zip) | 43,389,665 |
| 2021 | [DatosAbiertos_DECEyEC_ConteosCensales2021.zip](https://ine.mx/wp-content/uploads/2022/04/DatosAbiertos_DECEyEC_ConteosCensales2021.zip) | 44,357,326 |
| 2024 | [DatosAbiertos_DECEyEC_ConteosCensales2024.zip](https://ine.mx/wp-content/uploads/2025/08/DatosAbiertos_DECEyEC_ConteosCensales2024.zip) | 82,419,841 |

El 13 de octubre de 2026 se recuperó el HTML del landing y se resolvieron sus hrefs. Las seis URL respondieron a HEAD con 200 y `application/zip`, sin redirección. Esa operación acredita disponibilidad y encabezados, no la identidad del contenido local. Después, el script descargó los seis archivos completos y registró su coincidencia SHA-256 con el catálogo, cuyos hashes de referencia proceden de los ZIP locales completos inventariados. Los tamaños efectivamente registrados en la descarga coinciden con la tabla.

## Adquisición y fechas

Las fechas originales de adquisición de los ZIP facilitados localmente por el usuario son desconocidas. No se deducen del mtime, del nombre de una carpeta de uploads ni de Last-Modified HTTP. `downloaded_at` registra exclusivamente una descarga efectivamente terminada por el script; `verified_at` registra cuándo se comprobó su archivo. Ambos se expresan en UTC.

`raw/downloads.json` guarda por corte URL solicitada, URL final, bytes, SHA-256, fecha efectiva y fecha de verificación. El inspector incorpora el registro compatible en `sources[].download_record` y `downloaded_at` del informe. Al reutilizar un ZIP válido se mantiene su fecha de adquisición conocida; si no hay registro fiable, la adquisición histórica queda nula. `inspected_at` identifica otra operación: no es la fecha de descarga ni la de producción original del INE.

Las nuevas descargas efectivas de esta entrega quedaron registradas así; las URL finales coinciden con las solicitadas:

| Año | `downloaded_at` UTC |
| --- | --- |
| 2009 | `2026-10-13T15:16:24.915Z` |
| 2012 | `2026-10-13T15:16:26.135Z` |
| 2015 | `2026-10-13T15:16:27.458Z` |
| 2018 | `2026-10-13T15:16:28.824Z` |
| 2021 | `2026-10-13T15:16:30.246Z` |
| 2024 | `2026-10-13T15:16:32.767Z` |

Estas fechas corresponden a la adquisición nueva del módulo, no a las fechas desconocidas de los archivos que el usuario ya tenía. El manifiesto de descarga y la procedencia de inspección conservan las huellas completas.

## Universo y comparabilidad

Los TXT describen los cuadernillos de lista nominal de las casillas aprobadas por los consejos distritales. Excluyen casillas especiales y el voto de mexicanas y mexicanos residentes en el extranjero. La sección se refiere a la residencia consignada en la credencial. Los cómputos distritales parten de actas de escrutinio y cómputo: no se deben intercambiar esos universos sin un cotejo explícito.

El agregado DATA-01 compara entidades por clave INE EDOCVE. Los diccionarios 2009-2021 referencian DERFE 2021 para DEF/DEL; 2024 referencia DERFE 2023. La plataforma actual presenta los seis años con cartografía de mayo de 2023. Esas descripciones no prueban que los ZIP antiguos estén armonizados a la misma cartografía que el tablero en municipio, distrito o sección. El alcance de entidad no certifica comparabilidad de límites distritales ni seccionales.

Cada ZIP inventariado tiene 32 CSV de entidad y un TXT. Los 192 encabezados coinciden en las mismas 16 columnas. Los diccionarios 2009-2021 son idénticos byte a byte; el TXT 2024 tiene cambios metodológicos y de categorías. Se conserva un diccionario por corte. La evidencia de prefijos, limitada a 256 líneas de datos por CSV, se distingue de la lectura completa y no se utiliza para inventar conteos o tasas poblacionales.

## Referencias de contraste oficiales

Las páginas pertinentes del manual fueron descargadas, renderizadas y revisadas visualmente. El manual, pp. 17-18, define participación sobre SV+NV y no especificados sobre LN. Su p. 21 muestra estas referencias con un decimal:

| Año | Participación nacional mostrada | Precisión del contraste |
| --- | ---: | --- |
| 2009 | 44,1% | Redondeo a un decimal. |
| 2012 | 62,1% | Redondeo a un decimal. |
| 2015 | 47,1% | Redondeo a un decimal. |
| 2018 | 62,4% | Redondeo a un decimal. |
| 2021 | 51,8% | Redondeo a un decimal. |
| 2024 | 59,7% | Redondeo a un decimal; también hay conteos compatibles en p. 16. |

Para 2024, la p. 16 muestra LN 98,330,348; SV 54,899,228; NV 37,105,466 y NS 6,325,654. Para Aguascalientes muestra LN 1,097,171; SV 626,084; NV 441,222 y NS 29,865. Estos conteos permiten un contraste exacto para esos filtros de 2024. Las tasas de los otros años constituyen un contraste de redondeo; el manual no verifica allí conteos exactos. El informe declara esa diferencia de precisión respecto del benchmark externo.

Las imágenes del manual son ejemplos de vistas con sus filtros. Comparar otra entidad, sexo, edad o universo requiere aplicar filtros equivalentes y volver a sumar los conteos. Un valor coincidente por redondeo no permite afirmar igualdad de todas las filas ni de todos los niveles territoriales.

## Integridad y regeneración

La auditoría independiente completa recorrió 54,872,712 filas de los 192 CSV y reconstruyó 20,755 grupos con la misma clave de entidad/año/sexo/banda/tipo. Se usó un lector separado que no importa las funciones del ETL Node. Los conteos obtenidos de los registros originales son:

| Año | Filas originales | Grupos | LN | SV | NV | NS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2009 | 8,706,843 | 3,450 | 77,481,831 | 33,316,974 | 42,298,963 | 1,865,894 |
| 2012 | 8,604,456 | 3,449 | 76,490,962 | 47,383,154 | 28,939,159 | 168,649 |
| 2015 | 9,106,059 | 3,451 | 83,563,462 | 36,926,612 | 41,517,874 | 5,118,976 |
| 2018 | 9,251,122 | 3,450 | 89,123,997 | 51,784,399 | 31,249,856 | 6,089,742 |
| 2021 | 9,430,502 | 3,452 | 93,532,133 | 46,389,189 | 43,099,624 | 4,043,320 |
| 2024 | 9,773,730 | 3,503 | 98,330,348 | 54,899,228 | 37,105,466 | 6,325,654 |

La comprobación independiente de los conteos crudos y de su agregación tiene una finalidad distinta del contraste externo con el manual. En 2009-2021, `official_reference.exact_counts_independently_verified=false` significa que el benchmark externo de ese manual no verifica conteos exactos: solo permite el cotejo de participación redondeada. No significa que la conservación y la reconstrucción independiente de los conteos de esos ZIP queden sin comprobar. La comparación final comprobó los 20,755 grupos del ETL y las 150 filas del fixture sin discrepancias de conteos, etiquetas, porcentajes, denominadores, selección u orden.

`ccpc:download` verifica firma ZIP y hash antes de publicar un archivo, conserva archivos locales discrepantes para revisión y guarda los metadatos. `ccpc:inspect` verifica el ZIP contra el catálogo y calcula la huella de cada CSV/TXT sobre sus bytes originales. El fixture añade `checksums.sha256` para el CSV reducido, su procedencia y los seis TXT.

Las fuentes pesadas se regeneran con los scripts y no forman parte del paquete pequeño. El checksum del CSV permite verificar determinismo del dato; el JSON también contiene la fecha de inspección, que puede cambiar entre ejecuciones. Los controles y el estado de aceptación constan en [checklist](checklist.md).

Las huellas de los CSV de esta entrega son:

| Producto | SHA-256 |
| --- | --- |
| Agregado completo, 20,755 filas | `fc080268b7e32a932f738b05b59d4fc86897051e3e0e4664d31209901de6f490` |
| Fixture, 150 filas | `e8319aa4f5577a3de5e768df04775812a9f71427d1e2fdfac03a10902484c2e9` |

El contraste de porcentajes considera la presentación a seis decimales del CSV, con tolerancia de 0.00000051 puntos porcentuales. Los cuatro conteos enteros se comparan exactamente. La regeneración del fixture desde el agregado completo conservó todos sus bytes con el orden original y con el orden inverso de entrada. [Evidencia de aceptación](acceptance-evidence.json) registra los métodos, resultados y ejecución de 47/47 pruebas, además de TypeScript con código cero.
