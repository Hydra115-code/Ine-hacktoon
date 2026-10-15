# Checklist DATA-03

Los siete puntos están implementados y verificados con datos reales de DATA-02. Se mantienen los cinco archivos solicitados, incluida la prueba directa de cada consulta.

- [x] Consultas independientes de Gemini.
- [x] Filtros tipados.
- [x] Salidas Zod.
- [x] Fuente en cada respuesta.
- [x] Advertencias de comparabilidad.
- [x] Pruebas deterministas.
- [x] Documentar ejemplos de entrada/salida.

| Punto | Evidencia verificable |
| --- | --- |
| Independencia | Los tres archivos de producción solo contienen selección, cálculo, hashing y validación. Las pruebas comprueban ausencia de dependencias de red, archivos, reloj, aleatoriedad y proveedores de modelos. El adaptador de carga está separado. |
| Filtros | Tipos Year/EntityCode/Sex/AgeGroup/SectionType, Zod estricto y orden canónico. Pruebas positivas AND/OR y negativas de año, clave, campos desconocidos, listas vacías/duplicadas y dimensión no admitida. |
| Zod | Dependencia real `zod@4.6.7`, cuatro esquemas exportados y `.parse` antes de devolver. Pruebas que rechazan métricas alteradas, unidades incompatibles, fuente ausente, filtros contradictorios y cambios electorales incorrectos. |
| Fuente | URL oficial y hashes ZIP/CSV/diccionario en cada contexto disponible, hash del snapshot y selección, filas contribuyentes. Incluso no_data retiene contexto o URL de catálogo sin fabricar hashes. |
| Comparabilidad | Avisos de muestra parcial, universos/NS, marcos cartográficos, cambios de categorías, nombres históricos y celdas pequeñas. No_binario anterior a 2024 es ausencia de datos, nunca cero imputado. |
| Determinismo | Snapshot inmutable, filtros copiados, orden fijo, sin reloj ni llamadas de modelo. Repeticiones de los cuatro métodos idénticas; mutar una respuesta no afecta a las siguientes. |
| Ejemplos | Cuatro llamadas con entrada y salida completas en [sample](data03-examples/sample/queries.json) y [full](data03-examples/full/queries.json), ambos con SHA-256 y comando reproducible. |

La suite integrada pasó **114/114 pruebas, cero omitidas**, y TypeScript terminó con código cero. DATA-03 agrega 10 pruebas del repositorio y 17 del servicio a las 87 existentes. Las pruebas cargan el fixture con el validador DATA-02 antes de crear el motor y contrastan cantidades con el CSV de DATA-01. Los casos sintéticos de límites numéricos se identifican como tales y no se presentan como observaciones oficiales.

Un segundo cálculo en Python, sin importar helpers de producción, comprobó todos los registros del dataset completo validado y produjo resultados esperados. Un checker separado ejecutó las consultas y aprobó **14/14 controles** con cero diferencias: tres resúmenes, comparación temporal, desgloses, soporte, Zod, procedencia, avisos, ausencia histórica, filtros, determinismo e inmutabilidad.

## Ejemplos de hechos comprobados

| Consulta sobre el conjunto completo | Resultado |
| --- | --- |
| Resumen nacional 2024 | LN 98,330,348; SV 54,899,228; NV 37,105,466; NS 6,325,654. |
| Resumen Colima 2024 | LN 584,921; SV 321,763; NV 248,259; NS 14,899. |
| Comparación nacional 2018→2024 | −2.272347980101898 puntos nominales; −2.6950739698802693 puntos CCPC; −3.9108445491770145 % relativo nominal. |
| Soporte AGS/2024/hombre/18–19/urbana | Un grupo íntegro: LN 14,908; SV 7,288; NV 7,297; NS 323; 1,025 filas originales contribuyentes. |

Las cifras nacionales corresponden al conjunto completo; no se obtienen sumando el fixture. En la muestra, cada respuesta avisa explícitamente de su alcance parcial. El archivo [evidencia DATA-03](data03-acceptance-evidence.json) registra los hashes y comprobaciones ejecutadas.

La Definition of Done queda satisfecha para este módulo: las cuatro funciones se llaman directamente desde pruebas y devuelven evidencia real validada. El backend puede registrar esas funciones como tools MCP; esta entrega no instala ni publica un servidor MCP.
