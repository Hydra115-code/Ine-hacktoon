# Estado de la entrega al equipo

Esta carpeta consolida DATA-01, DATA-02 y DATA-03 para seis cortes: 2009, 2012, 2015, 2018, 2021 y 2024. No son datos anuales continuos. Se mantiene el alcance entidad, sexo, banda de edad y tipo de sección; no se habilitan municipio, distrito o sección.

## Preparación para el repositorio

- README y guía de integración del equipo, con ruta rápida de muestra y regeneración completa separadas.
- Comandos `ccpc:check` y `ccpc:verify-delivery`, inventario SHA-256 y Node de referencia.
- Evidencia independiente DATA-03 conservada y scripts de auditoría adaptados a la raíz; sus resultados nuevos se escriben en `processed/`, excluido por Git.
- Dos campos históricos `input` de `docs/data02-acceptance-evidence.json` cambiados de rutas personales a relativas. No se modificaron resultados, fechas ni hashes de datos.
- Regla general `.gitattributes` para preservar los bytes recibidos; se mantienen reglas específicas de fixtures y diccionarios.

## Aceptación y límites

DATA-02 conserva 11/11 puntos y DATA-03 7/7. DATA-01 conserva 8/9: no se detectaron identificadores personales directos, pero existen celdas LN=1. La afirmación absoluta de ausencia de datos personales permanece abierta; no se suprimieron ni manipularon celdas para aprobar el checklist.

La suite integrada contiene 114 pruebas. Los recuentos históricos de 47 (DATA-01) y 87 (DATA-02) no deben sumarse a 114. Los 14 controles independientes DATA-03 documentan otra comprobación previa del conjunto completo. La verificación de esta carpeta se registra por separado en `delivery-validation.json`.

La muestra tiene 150 grupos completos y es parcial. Los ejemplos `full` son resultados previos del conjunto completo validado; no prueban que el equipo haya regenerado ese conjunto en su máquina. Preparar esta carpeta no vuelve a descargar ni procesar las 54,872,712 filas crudas: preserva la evidencia previa y comprueba nuevamente la ejecución sobre el fixture.

El servicio está listo para recibir adaptadores del backend. No se instala un servidor MCP, API HTTP, autenticación, base de datos ni interfaz. Otro backend puede necesitar adaptar resolución de imports y carga TypeScript, conservando validaciones, evidencia y unidades.

## Reparto técnico sugerido

| Rol | Acción | Criterio de cierre |
| --- | --- | --- |
| Backend | Cargar con `validateFile`, crear repositorio/servicio y envolver las cuatro consultas. | Respuestas Zod con fuentes y avisos; errores explícitos. |
| Datos | Regenerar los seis ZIP y el ETL cuando se necesiten totales completos. | SHA de fuente válido, validación completa y snapshot identificado. |
| Frontend | Mostrar métricas calculadas, unidades, fuente y avisos. | No inventar cifras con modelos, interpretar ausencias como ceros ni llamar nacionales a sumas del fixture. |
| QA | Ejecutar `ccpc:check` y revisar comparaciones y casos sin datos. | Pruebas/TypeScript aprobados y contratos respetados. |

Son roles sugeridos, no asignaciones personales ni autorización para publicar celdas pequeñas.
