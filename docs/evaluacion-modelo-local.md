# Evaluación del modelo local para el planificador

- Fecha: 2026-10-23 03:36 UTC
- Modelo: qwen2.5:1.5b en http://127.0.0.1:11434 (disponible)
- Tiempo límite por consulta: 8000 ms
- Conexión a internet durante la prueba: desconectada
- Consultas: 40 (34 del dominio electoral y 6 fuera de dominio)
- Memoria del modelo cargado: 1115 MB (VRAM 1115 MB)
- Memoria del proceso de evaluación: 79 MB

| Modo | Intención correcta | Filtros correctos | Inventó filtros | Fuera de dominio | Latencia p50 / p95 / máx | Respaldos |
|---|---|---|---|---|---|---|
| Reglas | 40/40 | 38/40 | 0 | 6/6 | 0 / 4 / 5 ms | 0 |
| Modelo local con respaldo a reglas | 36/40 | 17/40 | 21 | 6/6 | 417 / 1132 / 1162 ms | 10 |
| Sólo el modelo local | 26/40 | 7/40 | 21 | 2/6 | 417 / 1132 / 1162 ms | 10 |

## Conclusión

No mejora: con el modelo local hay 17/40 filtros correctos contra 38 de las reglas, inventa 21 filtros y tarda 1132 ms en el percentil 95 contra 4 ms. Se mantiene `UI_PLANNER_MODE=rules` por defecto; `local-model` queda como opción con respaldo automático a reglas.

- Errores de las reglas: entidad equivocada (2).
- Errores del modelo local (con respaldo): filtro de sexo equivocado (16), entidad equivocada (14), tipo de análisis equivocado (4), grupos de edad equivocados (3), años equivocados (1).

## Casos con diferencias

| Consulta | Reglas | Modelo local |
|---|---|---|
| ¿Cuál fue la participación en Veracruz en 2018? | ✅ summary · 2018 · entidades 30 | ❌ summary · 2018 · entidades 30 · no_binario |
| partisipacion en jalisko 2024 | ❌ summary · 2024 | ❌ summary · 2024 · entidades 14 · no_binario |
| ¿Qué tan participativos fueron los neoleoneses en 2018? | ✅ summary · 2018 · entidades 19 | ❌ summary · 2018 · entidades 19 · no_binario |
| Nivel de votación en la capital del país en 2021 | ❌ summary · 2021 | ❌ summary · 2021 · entidades 10 · hombre |
| ¿Cuánta gente fue a votar en Yucatán en 2015? | ✅ summary · 2015 · entidades 31 | ❌ summary · 2015 · entidades 29 · no_binario |
| abstención en Chiapas 2024 | ✅ summary · abstention · 2024 · entidades 07 | ❌ summary · abstention · 2024 · entidades 17 |
| ¿Cuántas personas estaban en la lista nominal de Sonora en 2021? | ✅ summary · nominal-list · 2021 · entidades 26 | ❌ summary · nominal-list · 2021 · entidades 27 · no_binario |
| Participación de mujeres en Guanajuato 2024 | ✅ summary · 2024 · entidades 11 · mujer | ❌ summary · 2024 · entidades 12 · mujer |
| Votación de jóvenes de 18 a 24 años en Puebla 2018 | ✅ summary · 2018 · entidades 21 · edad 18-19…20-24 | ❌ summary · 2018 · entidades 15 · no_binario · edad 18-19…20-24 |
| Adultos mayores de 65 en Coahuila 2024, ¿votaron? | ✅ summary · 2024 · entidades 05 · edad 65-69…100+ | ❌ summary · 2024 · entidades 15 · no_binario · edad 65-69…65-69 |
| Compara 2012 y 2018 en Michoacán | ✅ comparison · 2012/2018 · entidades 16 | ❌ comparison · 2012/2018 · entidades 14 · hombre,mujer |
| ¿Subió la participación en Baja California entre 2015 y 2021? | ✅ comparison · 2015/2021 · entidades 02 | ❌ trend · 2015/2021 · entidades 02 · hombre,mujer |
| Diferencia de participación entre la elección de 2024 y la anterior en Querétaro | ✅ comparison · 2021/2024 · entidades 22 | ❌ comparison · 2021/2024 · entidades 24 · hombre,mujer |
| Evolución de la participación en Tamaulipas | ✅ trend · 2009/2012/2015/2018/2021/2024 · entidades 28 | ❌ trend · 2009/2012/2015/2018/2021/2024 · entidades 28 · hombre,mujer |
| ¿Cómo ha cambiado la abstención desde 2012 a nivel nacional? | ✅ trend · abstention · 2012/2015/2018/2021/2024 | ❌ trend · abstention · 2012/2018 |
| Serie histórica de participación en Hidalgo de 2009 a 2024 | ✅ trend · 2009/2012/2015/2018/2021/2024 · entidades 13 | ❌ trend · 2009/2012/2015/2018/2021/2024 · entidades 13 · hombre,mujer |
| Participación por sexo en Tabasco 2018 | ✅ breakdown · por sexo · 2018 · entidades 27 | ❌ summary · 2018 · entidades 28 · hombre,mujer |
| ¿Votan más los hombres o las mujeres en Zacatecas? 2021 | ✅ breakdown · por sexo · 2021 · entidades 32 · hombre,mujer | ❌ breakdown · por sexo · 2021 · entidades 30 · hombre,mujer |
| Participación por grupos de edad en Campeche 2024 | ✅ breakdown · por grupo_edad · 2024 · entidades 04 | ❌ breakdown · 2024 · entidades 14 · no_binario · edad 18-19…100+ |
| Pirámide de participación por edad y sexo de Durango 2018 | ✅ breakdown · por grupo_edad · 2018 · entidades 10 · hombre,mujer | ❌ breakdown · 2018 · entidades 10 · hombre,mujer · edad 18-19…100+ |
| Compara Jalisco, Nuevo León y la Ciudad de México en 2024 | ✅ breakdown · por entidad · 2024 · entidades 09,14,19 | ❌ comparison · 2024 · entidades 09,14,25 |
| Muéstrame los registros de Colima en 2021 | ✅ evidence · 2021 · entidades 06 | ❌ evidence · 2021 · entidades 14 · no_binario |
| ¿Qué son los conteos censales de participación? | ✅ methodology | ❌ summary |
