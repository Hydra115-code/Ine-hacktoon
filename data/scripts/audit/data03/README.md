# Auditoría independiente DATA-03

Estos scripts reproducen el contraste independiente de las cuatro consultas: Python calcula los resultados esperados sin importar los helpers de producción; Node ejecuta el motor y comprueba 14 controles. No descargan ni transforman ZIP.

Requieren Python 3.10 o posterior, la versión de Node indicada en el README principal y las dependencias instaladas mediante `npm ci --ignore-scripts`.

## Preparar los datos

Antes de ejecutar el contraste completo, regenera el conjunto completo desde la raíz del módulo, siguiendo el orden del README principal:

```powershell
npm run ccpc:download -- --year all
npm run ccpc:inspect -- --year all --sample
npm run ccpc:pipeline
npm run ccpc:validate -- --input data/ccpc/sample/data02/participation.json
```

El conjunto completo permanece en `data/ccpc/processed/`, excluido de Git. No lo copies a `sample/`. El validador necesita también el CSV completo de DATA-01, por eso se ejecuta la inspección antes del pipeline.

## Ejecutar la auditoría

Desde la raíz del módulo:

```powershell
python -X utf8 scripts/audit/data03/independent_queries.py
node scripts/audit/data03/check_queries.mjs
```

Si tu instalación de Windows usa el lanzador `py`, sustituye `python` por `py -3`.

Ambos scripts resuelven sus rutas desde su propio archivo. Python escribe `data/ccpc/processed/audit-data03/expected-results.json`; Node lee ese resultado y escribe `query-execution-report.json` en el mismo directorio, también excluido de Git. Ejecuta primero Python y después Node.

Python conserva el comportamiento original: si no encuentra el conjunto completo, calcula únicamente sobre el fixture y lo declara como muestra, sin estimaciones nacionales. Esa ejecución parcial no sustituye la auditoría completa: el checker Node requiere el conjunto completo y falla si falta. Un fallo de aserción o validación termina con código distinto de cero.

Los resultados históricos de la entrega están en `docs/evidence/data03-independent/`; las ejecuciones nuevas se guardan por separado y pueden tener hashes distintos por sus rutas relativas y metadatos de adquisición. No alteres resultados históricos para presentar una ejecución nueva como anterior.
