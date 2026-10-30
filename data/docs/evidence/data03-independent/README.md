# Evidencia histórica independiente DATA-03

Estos archivos corresponden al control independiente realizado durante DATA-03 sobre el conjunto completo y la muestra. Se preservan sin modificar sus bytes. No representan una nueva ejecución al preparar la entrega.

- `expected-results.json`: valores de un lector Python separado de los helpers de producción.
- `query-execution-report.json`: ejecución del motor contra esos valores; 14/14 controles aprobados.

El dataset completo tenía SHA-256 `55c2cabcc9197e768b5c6092d277b77f2aa1bf9e9efa91805a9ffec47eea8df1`. La muestra tenía SHA-256 `a42330379938a20b4a3e63a2625312c4d10b260de246825c6dc2c8bb0b9c11a1`.

Para reproducir, regenerar DATA-01 y DATA-02 y seguir [la auditoría](../../../scripts/audit/data03/README.md). La ejecución nueva escribe en `data/ccpc/processed/audit-data03/`; no sobrescribe esta evidencia histórica. Cambios de adquisición pueden producir hashes nuevos que se deben explicar.
