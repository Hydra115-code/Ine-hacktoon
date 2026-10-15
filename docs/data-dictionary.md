# Diccionario DATA-01: seis cortes CCPC

Fuentes: los seis TXT originales incluidos en los ZIP y el [manual oficial CCPC 2009-2024](https://ine.mx/wp-content/uploads/2025/06/Manual-Conteos-Censales-2009-2024.pdf). Los TXT se conservan sin edición en `data/ccpc/sample/dictionary-{año}.txt` al generar el fixture.

## Columnas originales

La inspección completa de los 192 CSV confirmó estas 16 columnas y este orden. Los dominios y faltantes se revisaron por corte; un encabezado común no se utilizó como prueba de igualdad de contenidos.

| Campo | Definición de origen | Uso DATA-01 |
| --- | --- | --- |
| `AELEC` | Año de elección. | Debe coincidir con 2009, 2012, 2015, 2018, 2021 o 2024 y con el ZIP. |
| `FELECCION` | Fecha de la jornada electoral, descrita como formato corto. | Se conserva su literal en la inspección; no se interpreta como fecha del contrato. |
| `EDOCVE` | Clave INE de entidad federativa. | Identidad territorial y validación de 32 entidades. |
| `EDONOM` | Nombre de entidad. | Etiqueta de origen y perfil de nombres. |
| `MPIOCVE` | Clave INE de municipio. | Control de clave cruda; no se exporta. |
| `MPIONOM` | Nombre del municipio. | Perfil de faltantes; no se exporta. |
| `SECCION` | Sección electoral en el año correspondiente. | Control de clave cruda; no se exporta. |
| `TIPOSEC` | Tipo de sección. | U/M/R producen `urbana`/`mixta`/`rural`. |
| `DEF` | Distrito federal en marco DERFE 2021 para TXT 2009-2021 y 2023 para TXT 2024. | Se inspecciona; no se exporta. |
| `DEL` | Distrito local en esos mismos marcos. | Se perfila y puede quedar vacío; no participa en la agrupación ni se exporta. |
| `SEXO` | 0 Hombres, 1 Mujeres; 2024 añade 2 No binario. | Código y etiqueta, validación por corte. |
| `EDAD` | Años cumplidos al día de la elección. | Banda de edad; conserva los conteos de edades mayores de 100. |
| `LN` | Lista nominal de los cuadernillos para las casillas catalogadas. | Conteo agregado. |
| `SV` | Registros con marca de voto. | Conteo agregado. |
| `NV` | Registros sin marca de voto. | Conteo agregado separado de NS. |
| `NS` | Registros con participación no especificada. | Conteo agregado y tasa sobre LN. |

La identidad cruda controlada dentro de cada CSV es municipio × sección × sexo × edad. El archivo ya fija año y entidad. El inspector rechaza duplicados de esa clave; no supone que las filas estén contiguas por grupo o ordenadas por edad.

## Campos del CSV agregado

| Campo | Tipo y unidad | Regla |
| --- | --- | --- |
| `entidad_clave` | Texto de dos dígitos | `EDOCVE` INE de `01` a `32`; conserva el cero inicial. |
| `entidad` | Texto | `EDONOM` del CSV, sin espacios exteriores. No se sustituye por una etiqueta canónica inventada. |
| `anio` | Entero | Uno de los seis años catalogados. |
| `sexo_codigo` | Entero | 0/1; 2 permitido únicamente en 2024. |
| `sexo` | Texto | `hombre`, `mujer`, `no_binario`. |
| `grupo_edad` | Texto | Una de las 18 bandas documentadas abajo. |
| `tipo_seccion` | Texto | `urbana`, `mixta`, `rural`; no identifica una sección. |
| `LN` | Personas/registros, entero no negativo | Suma LN de la clave de salida. |
| `SV` | Registros, entero no negativo | Suma SV. |
| `NV` | Registros, entero no negativo | Suma NV. |
| `NS` | Registros, entero no negativo | Suma NS; no se reclasifica como NV. |
| `participacion_pct` | Porcentaje o vacío | `100*SV/(SV+NV)`. |
| `abstencion_pct` | Porcentaje o vacío | `100*NV/(SV+NV)`. |
| `no_especificado_pct` | Porcentaje o vacío | `100*NS/LN`. |
| `denominador_participacion` | Registros, entero no negativo | `SV+NV`. |

Clave de salida: `(anio, entidad_clave, sexo_codigo, grupo_edad, tipo_seccion)`. El fixture y el agregado completo comparten claves; no deben sumarse entre sí.

## Edad, sexo y categoría territorial

Bandas oficiales del manual, p. 12: `18-19`, `20-24`, `25-29`, `30-34`, `35-39`, `40-44`, `45-49`, `50-54`, `55-59`, `60-64`, `65-69`, `70-74`, `75-79`, `80-84`, `85-89`, `90-94`, `95-99`, `100+`. Son 18 intervalos: el primero abarca dos edades y el último es abierto. EDAD debe ser entero de al menos 18; no se impone un máximo arbitrario que elimine los registros de edades avanzadas. DATA-01 no mezcla filas por etapa de vida con estas bandas.

No binario está documentado únicamente para 2024 en su TXT y en el manual, p. 13. Su ausencia en las publicaciones anteriores no es una observación de cero. Los cruces sin fila no se rellenan artificialmente.

El recorrido independiente de todas las filas confirmó EDAD mínima 18 y estos máximos: 2009=130, 2012=132, 2015=117, 2018=137, 2021=139 y 2024=140. Todos los registros de 100 años o más entran en `100+`; no se recortan los conteos por un máximo supuesto. SEXO=2 aparece en 105 filas originales de 2024. Esa cifra cuenta filas de origen, no personas: las personas/registros se obtienen sumando LN y los otros conteos.

Los TXT 2009-2021 describen TIPOSEC con palabras, pero el recorrido independiente completo de los seis años confirma U/M/R como valores CSV. El código valida esos códigos y publica sus etiquetas. Esta comprobación completa distingue los valores observados de la descripción textual del diccionario.

## Fórmulas y calidad

Se suman LN, SV, NV y NS de todas las filas de cada clave y luego se calculan los porcentajes. No se promedian porcentajes de otras edades o territorios. El manual, pp. 17-18, excluye NS del denominador de participación y abstención; la participación no se obtiene dividiendo SV entre LN.

Si `SV+NV=0`, participación y abstención son nulas; si `LN=0`, la tasa de NS es nula. En CSV se escriben celdas vacías, no cero. Con denominador positivo, participación y abstención suman 100 salvo redondeo de presentación. Se conserva hasta seis decimales en CSV; los conteos no se redondean.

Los controles exigen enteros no negativos y seguros para JavaScript, categoría permitida, año/entidad consistentes, unicidad cruda, 32 entidades y conservación de conteos al agregar. La identidad `LN=SV+NV+NS` se comprueba como control contable de las filas y agregados; no se atribuye al TXT una fórmula que no explicita.

### Faltantes

El perfil recorre las 16 columnas antes de convertir los datos. Distingue categorías excluyentes: `empty` para cadena vacía, `whitespace_only` para solo espacios y `missing_token` para `NULL`, `N/A`, `NA`, `NAN`, `NONE`, `S/D` o `-`, después de quitar espacios y sin distinguir mayúsculas. `total_missing` suma esas tres cuentas. Cero es dato válido y NS positivo no es una celda faltante.

Los campos necesarios para el contrato siguen sujetos a validación: perfilar un valor ausente no autoriza aceptarlo como cero. DEF y DEL no participan en la clave a nivel entidad; sus faltantes se registran y no se rellenan ni justifican descartar conteos. Los resultados completos de todas las filas y las 16 columnas constan en `sources[].missing_values` y, por CSV, `sources[].members[].missing_values` de los informes.

El perfil completo Node detectó estos casos, corroborados por el recorrido independiente; no son extrapolaciones del inventario de prefijos:

| Año | DEF, solo espacios | DEL, solo espacios | DEL, vacío literal |
| --- | ---: | ---: | ---: |
| 2009 | 28,477 | 28,477 | 0 |
| 2012 | 15,677 | 15,677 | 0 |
| 2015 | 0 | 0 | 0 |
| 2018 | 0 | 0 | 0 |
| 2021 | 0 | 0 | 0 |
| 2024 | 0 | 0 | 20,912 |

Fuera de esos casos, las 16 columnas no presentan faltantes bajo la definición anterior. No hay marcadores de ausencia en ningún año, y no hay celdas de solo espacios fuera de los casos DEF/DEL indicados. El perfil Node verificó las tres categorías de ausencia en todas las filas; el lector independiente corroboró vacíos de las 16 columnas y solo espacios en DEF/DEL.

### Nombres

Se compara EDONOM por EDOCVE y se conserva el nombre observado en cada corte. `names` reúne etiquetas y frecuencias, además de espacios exteriores. `entity_name_comparison` identifica años comparados, cambios de etiqueta y conflictos dentro de un año. Una inspección de un solo año no evalúa la comparación entre los seis cortes.

El recorrido independiente completo muestra la clave 09 como `DISTRITO FEDERAL` en 2009, 2012, 2015 y 2018, y `CIUDAD DE MEXICO` en 2021 y 2024. Los TXT antiguos contienen otra etiqueta histórica explicativa para esa clave. Se registra la diferencia sin reescribir retrospectivamente los CSV; las uniones usan EDOCVE y no la coincidencia literal del nombre. Este control no resuelve homonimias ni equivalencias municipales.

La comparación integral Node evaluó los seis años, confirmó ese único cambio de etiqueta, no encontró conflictos dentro de un corte y contó cero nombres EDONOM con espacios exteriores. Esos resultados están en `entity_name_comparison` y `sources[].names` de la procedencia.

### Codificación

La auditoría independiente validó como UTF-8 todos los bytes de los 192 CSV y seis TXT: los CSV 2009-2021 están sin BOM y con LF; los de 2024 tienen BOM y CRLF. Los seis TXT se preservaron byte a byte. El inspector Node también valida estrictamente todo el flujo de cada CSV/TXT, admite BOM al interpretar el encabezado y registra BOM, bytes y finales de línea. Un prefijo ASCII no identifica de forma única una codificación; las afirmaciones anteriores proceden del recorrido completo. Los hashes se calculan antes de transformar los bytes.

Los seis TXT son UTF-8 sin BOM y con LF: 2,557 bytes para cada corte 2009-2021 y 2,502 para 2024. Los CSV usan coma como separador; el BOM de 2024 se reconoce para leer el encabezado y se conserva al calcular su SHA-256.

## Diferencias documentadas

Los TXT 2009-2021 son idénticos entre sí. Su enumeración de años no prueba que un ZIP contenga más de un corte. El TXT 2024 agrega la categoría de sexo 2, explicita los códigos U/M/R, usa DERFE 2023 para DEF/DEL y omite la causa NS relativa a un cuadernillo solicitado judicialmente. El manual general sigue enumerando esa causa. El conteo NS se conserva, sin inventar una desagregación de motivos.

FELECCION solo está definido como formato corto. Los literales observados varían desde `5/7/2009` hasta `06/02/2024`; no se decide automáticamente entre día/mes y mes/día. Se preservan los literales de inspección y el año se toma de AELEC. La diferencia de cartografía entre TXT y plataforma se explica en [fuentes](data-sources.md).

## Alcance de la revisión de datos personales

Las 16 columnas originales describen lugares, categorías sociodemográficas y conteos. No contienen campos de nombre de persona, domicilio personal, teléfono, correo, CURP, clave de elector u otro identificador personal directo. EDONOM y MPIONOM son nombres de lugares. La salida tiene 15 campos a nivel entidad y omite claves municipales, distritales y seccionales.

Esta revisión de esquema y producto no certifica anonimato absoluto ni imposibilidad de inferencia. La combinación de edad, sexo y territorio produce celdas de baja frecuencia: la auditoría independiente completa encontró grupos con LN=1 en todos los cortes. Su número fue 3, 7, 5, 2, 2 y 35 para 2009, 2012, 2015, 2018, 2021 y 2024, respectivamente: 54 grupos en total. El fixture tiene 4 filas LN=1 y 9 filas LN de 1 a 4. La revisión general «Confirmar que no existen datos personales» permanece parcial y con reserva; la [checklist](checklist.md) presenta la tabla completa y [evidencia de aceptación](acceptance-evidence.json) conserva esos resultados.

La entrega mantiene los datos íntegros, sin supresión ni imputación. El fixture es para desarrollo. Una publicación o consulta con mayor detalle deberá evaluar exposición y cruces externos; cualquier política futura tendrá que documentar su efecto y conservar separadamente el agregado auditado.
