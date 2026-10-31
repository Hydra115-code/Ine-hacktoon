# Checklist DATA-02

Los **once puntos están cerrados**. Se ejecutaron el ETL de los seis ZIP, el validador, 87 pruebas y una lectura independiente de todos los registros originales. La [evidencia de aceptación](data02-acceptance-evidence.json) contiene resultados y SHA-256 reales.

- [x] participationRate = voted / nominalList.
- [x] abstentionRate = didNotVote / nominalList.
- [x] Tasas entre 0 y 100.
- [x] Conteos no negativos.
- [x] Años permitidos.
- [x] Entidades válidas.
- [x] Numerador no mayor al universo.
- [x] No duplicar combinaciones.
- [x] Registrar valores no especificados.
- [x] Conservar procedencia.
- [x] Separar porcentaje de puntos porcentuales.

| Punto | Criterio comprobable |
| --- | --- |
| Participación | Fórmula nominal exacta, indicador oficial separado y fallo si se introduce una tasa distinta. |
| Abstención | Fórmula nominal exacta; NS permanece separado de NV. |
| Rango | Razones 0–1, porcentajes 0–100, valores finitos; `null` únicamente cuando el denominador es cero. |
| Conteos | Enteros seguros no negativos; fracciones, NaN, infinito, negativos y overflow rechazados. |
| Años | Solo 2009, 2012, 2015, 2018, 2021, 2024 y concordancia de fuente/registro. |
| Entidades | Claves 01–32, nombre de origen correcto por año; 32 entidades por corte completo. |
| Universo | SV, NV y NS no exceden LN, y LN = SV + NV + NS. |
| Unicidad | Clave `(year, entityCode, sex, ageGroup, sectionType)` sin procedencia ni conteos; cambia el sourceId y sigue siendo duplicado. |
| NS | Conservación exacta por grupo y fuente, `unspecified`, razones y porcentajes propios; NS-only y LN=0 probados. |
| Procedencia | Archivo/miembro/diccionario y hashes, URL, adquisición conocida o desconocida, sourceRows y totales; contraste con DATA-01 y lector original independiente. |
| Unidades | Tipos/definiciones y funciones distintas para razón, porcentaje, diferencia en puntos y cambio relativo. |

## Hechos ejecutados

El proceso leyó **54,872,712 filas** y produjo **20,755 registros con 192 fuentes CSV**; el fixture JSON contiene **150 grupos completos, 10 fuentes y 112,036 bytes**. La comparación independiente comprobó los cuatro conteos y `sourceRows` exactamente por grupo, además de los nueve campos de indicadores con tolerancia decimal de 1e-12. Resultado: **cero diferencias** tanto en el conjunto completo como en el fixture. Esa tolerancia pertenece al cálculo independiente decimal; el esquema del producto exige igualdad exacta con las fórmulas JavaScript del contrato.

Dos lecturas completas independientes de los mismos ZIP utilizaron las mismas funciones de inspección, transformación y publicación entregadas: una mediante la CLI `ccpc:pipeline` y otra en un directorio de auditoría. Los seis archivos resultantes —datos, manifiesto y checksums, para completo y muestra— son **idénticos byte por byte**. No se reconstruyó la segunda salida copiando la primera.

| Producto | SHA-256 |
| --- | --- |
| JSON completo | `55c2cabcc9197e768b5c6092d277b77f2aa1bf9e9efa91805a9ffec47eea8df1` |
| JSON reducido | `a42330379938a20b4a3e63a2625312c4d10b260de246825c6dc2c8bb0b9c11a1` |

`npm run ccpc:pipeline`, el validador completo, el validador de muestra y TypeScript terminaron con código cero; **87/87 pruebas pasaron**. Entre las negativas ejecutadas figuran tasa alterada incluso +1e-13, fracciones/NaN/infinito/overflow, año/entidad/nombre/categoría inválidos, numerador mayor a LN, partición incorrecta, duplicados, mapa de procedencia ausente o adicional, publicación vacía antes de I/O, bloqueo ocupado y salida destinada a un directorio.

Las pruebas también publicaron deliberadamente candidatos con SV/NV redistribuidos entre dos grupos, métricas recalculadas y manifiesto/checksums nuevos. Pasaban el contrato numérico interno, pero el validador los rechazó por `REFERENCE_RECORD_MISMATCH`; la CLI salió con código 1 y no anunció validación. Una redistribución compensada de `sourceRows` fue rechazada por `SOURCE_ROWS_REFERENCE_MISMATCH`. Metadatos de miembro o fecha cambiados coherentemente se rechazaron por `TRUSTED_SOURCE_MISMATCH`.

Estas comprobaciones satisfacen la Definition of Done para las entradas y el contrato documentados. La autenticidad se apoya en el catálogo y las anclas independientes, no en que el dataset declare su propio hash. La reserva de privacidad de DATA-01 y el límite de publicación por directorio siguen documentados en el [contrato](data02-contract.md).
