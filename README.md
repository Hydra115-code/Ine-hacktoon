<<<<<<< HEAD
***Ine-Hackatoon***
=======
# Entrega CCPC: DATA-01, DATA-02 y DATA-03

Carpeta completa para el repositorio del equipo: fuentes, diccionarios, muestras, ETL, validación y consultas puras. Cubre **2009, 2012, 2015, 2018, 2021 y 2024**, a nivel **entidad × año × sexo × grupo de edad × tipo de sección**. No son observaciones anuales continuas.

## Empezar con la muestra

Usar **Node.js 24.14.1 y npm**, versión de referencia en `.nvmrc`. El rango compatible está en `package.json`. Es un módulo ESM con TypeScript nativo de Node, sin build previo. No necesita claves API, Gemini ni base de datos.

Desde esta carpeta:

```powershell
npm ci --ignore-scripts
npm run ccpc:verify-delivery
npm run ccpc:check
```

La instalación requiere acceso al registro npm. Después, estas comprobaciones funcionan sin red ni ZIP. `ccpc:check` ejecuta TypeScript, todas las pruebas, valida el fixture DATA-02 y genera los cuatro ejemplos DATA-03 en `docs/data03-examples/sample/`.

La muestra contiene **150 grupos completos** con manifiestos y SHA-256. Permite integrar y probar inmediatamente; sus sumas **no son totales estatales ni nacionales**. Las consultas incluyen `SAMPLE_DATA`.

## Qué subir al repositorio

Sube **todo el contenido de esta carpeta**, incluidos `.gitignore`, `.gitattributes` y `.nvmrc`. Si el repositorio está vacío, esta carpeta puede ser su raíz. Si existe un backend, seguir [la guía de integración](docs/team-integration.md); copiar solo `src/` no basta.

| Ruta | Contenido |
| --- | --- |
| `data/ccpc/` | Catálogo oficial, anclas verificadas, README y muestra CSV/JSON con diccionarios, procedencia y checksums. |
| `scripts/ccpc/` | Descarga, inspección, ETL, validación, ejemplos y verificación de entrega, con todos sus helpers. |
| `src/` | Dominio cívico, esquema, puerto, repositorio y servicio. |
| `tests/` | Pruebas DATA-01/02/03 y rechazos de datos inconsistentes. |
| `docs/` | Diccionario, fuentes/fechas, metodología, contratos, checklists, ejemplos y evidencias. |
| `scripts/audit/data03/` | Auditoría independiente opcional; requiere regenerar el conjunto completo y Python 3. |
| `package.json`, `package-lock.json`, `tsconfig.json` | Dependencias bloqueadas, comandos y configuración. |
| `DELIVERY-MANIFEST.json` | Inventario de esta entrega: rutas, tamaños y SHA-256. |

Los ZIP originales, `node_modules/`, `data/ccpc/raw/` y `data/ccpc/processed/` se regeneran localmente y quedan fuera de la entrega y Git. Se incluye todo para trabajar con la muestra y reconstruir el conjunto completo, sin datasets pesados.

## Regenerar los seis cortes completos

Ejecutar en este orden:

```powershell
npm run ccpc:download -- --year all
npm run ccpc:inspect -- --year all --sample
npm run ccpc:pipeline
npm run ccpc:validate -- --input data/ccpc/sample/data02/participation.json
npm run ccpc:queries -- --input data/ccpc/processed/data02/participation.json
```

La descarga verifica ZIP y SHA-256 y registra adquisición en `data/ccpc/raw/downloads.json`. La inspección crea `processed/entidad.csv` e `inspection.json`. El pipeline normaliza y valida el conjunto completo. Las consultas validan los archivos antes de usarlos; sus ejemplos completos quedan en `docs/data03-examples/full/`.

Tras una descarga nueva, inspección y ETL deben usar la misma procedencia de adquisición. No cambiar catálogo o anclas para hacer pasar un archivo distinto. Una publicación oficial nueva necesita auditoría. Las opciones `--zip-2009 PATH` hasta `--zip-2024 PATH` permiten usar archivos existentes en inspección/normalización; se verifican contra catálogo. Ver los contratos y `--help`.

La regeneración puede cambiar metadatos de adquisición y sus hashes. El manifiesto de entrega identifica el snapshot recibido y puede dejar de coincidir tras cambios intencionales; las validaciones propias de cada etapa siguen aplicando.

## Integrar las cuatro consultas

- `getParticipationSummary(filters)`
- `compareElections(filters, years)`
- `getParticipationBreakdown(filters, dimension)`
- `getSupportingRecords(filters)`

El backend usa `validateFile → createParticipationRepository → createParticipationService`. Hay [código ejecutable de integración](docs/team-integration.md) y [ejemplos de entrada/salida](docs/data03-examples/sample/queries.json). Las respuestas conservan filtros, unidades, fuentes, hashes y avisos. El backend debe crear el transporte y registro de tools MCP; no se incluye un servidor MCP desplegado.

## Estado real y documentación

| Paso | Estado | Evidencia |
| --- | --- | --- |
| DATA-01 | 8/9 cerrados; privacidad evaluada parcialmente, con reserva. | [Checklist](docs/checklist.md), [aceptación](docs/acceptance-evidence.json). |
| DATA-02 | 11/11 validaciones. | [Contrato](docs/data02-contract.md), [checklist](docs/data02-checklist.md), [aceptación](docs/data02-acceptance-evidence.json). |
| DATA-03 | 7/7 puntos y cuatro consultas. | [Contrato](docs/data03-contract.md), [checklist](docs/data03-checklist.md), [aceptación](docs/data03-acceptance-evidence.json). |

La evidencia previa comprende **54,872,712 filas originales, 192 CSV y 20,755 grupos completos**. Esas cifras no se obtienen de la muestra. La comprobación de esta carpeta consta en [delivery-validation.json](docs/delivery-validation.json). Los 14 controles independientes históricos y sus resultados se conservan en [evidencia DATA-03](docs/evidence/data03-independent/README.md).

Antes de usar resultados, leer [diccionario](docs/data-dictionary.md), [fuentes](docs/data-sources.md), [integración](docs/team-integration.md) y [estado de entrega](docs/delivery-status.md). NS se conserva separado de NV. Las tasas nominales y oficiales usan denominadores distintos; primero se suman conteos, después se divide. Ausencia de datos no es cero.

Hay celdas pequeñas, incluso LN=1. No se detectaron identificadores personales directos, pero **no se certifica anonimato absoluto**. La reserva DATA-01 sigue vigente al integrar o publicar soporte.

## Integridad de la carpeta recibida

`npm run ccpc:verify-delivery` compara los archivos listados con `DELIVERY-MANIFEST.json`; falla si falta alguno o cambian sus bytes. No es una firma digital ni valida archivos añadidos posteriormente. `.gitattributes` preserva los bytes recibidos, con reglas específicas para fixtures y diccionarios. No normalizar masivamente sus finales de línea.

No se incluyó historial `.git` ni se publicó un remoto. El equipo puede hacer su primer commit desde esta raíz después de comprobar la entrega.
>>>>>>> 6c7aac1 (feat(data): integrar fuentes, ETL y consultas CCPC 2009–2024 (DATA-01/02/03))
