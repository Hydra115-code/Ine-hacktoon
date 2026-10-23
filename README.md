# Ine-hacktoon · Entrega de Datos CCPC 1.0.0

Entrega final de la parte de **Datos** del hackatón: DATA-04, DATA-05 y DATA-06. Contiene el agregado completo de participación ciudadana, el catálogo compartido de preguntas respondibles, el adaptador de consultas y la versión 1.0.0 congelada con verificación de integridad.

**Resultado de la auditoría:** 26/26 puntos de checklist implementados y 149 pruebas aprobadas, sin bloqueantes en el flujo final. Esto acredita el módulo y la aplicación de referencia incluidos; la conexión con las aplicaciones reales de frontend y backend del equipo debe realizarse siguiendo esta guía.

## Descargar y ubicar la entrega final

- [Entrega-final-CCPC-1.0.0.zip](https://github.com/Hydra115-code/Ine-hacktoon/blob/Data/Entrega-final-CCPC-1.0.0.zip): usar **Download raw file** en GitHub.
- [Entrega-final-CCPC-1.0.0.zip.sha256](https://github.com/Hydra115-code/Ine-hacktoon/blob/Data/Entrega-final-CCPC-1.0.0.zip.sha256): checksum externo del archivo.

El ZIP agrupa las tres tareas; no hay que instalar ni combinar los ZIP de cada etapa. Al extraerlo, la carpeta ejecutable es **`Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06/`**.

En la rama `Data`, los archivos de código que estaban previamente en la raíz corresponden a DATA-01/02/03. Para ejecutar la entrega final 1.0.0 usa la carpeta extraída del ZIP indicado. Si ya estás leyendo este README dentro del ZIP, continúa con el arranque siguiente.

## Arrancar y comprobar

Requiere Node.js/npm y Python ≥3.10 para las auditorías. El rango Node declarado por el módulo es `^22.18.0 || >=23.6.0`; la validación final se ejecutó con **Node.js 26.7.0 y Python 3.14.7**. No se han probado aquí todas las versiones del rango.

En la carpeta donde descargaste el ZIP y su checksum:

```sh
sha256sum -c Entrega-final-CCPC-1.0.0.zip.sha256
unzip Entrega-final-CCPC-1.0.0.zip
cd Entrega-final-CCPC-1.0.0/Ine-hacktoon-DATA-06
npm ci --ignore-scripts
npm run ccpc:verify-delivery
npm run ccpc:check
npm run ccpc:demo
```

Abre **http://127.0.0.1:4186**. Mantén la terminal abierta; Ctrl+C detiene la demostración. Si ese puerto está ocupado, en Linux/macOS puedes usar `CCPC_RELEASE_PORT=4187 npm run ccpc:demo`.

`npm ci` necesita acceso a npm o una caché que contenga las dependencias. Después, las consultas, validaciones y demostración son locales: no requieren credenciales, API de IA, base de datos, ZIP originales del INE ni ejecutar el ETL. Python se requiere para auditar, no para servir las consultas Node.

## Qué se hizo durante el proceso

### DATA-04 — Sustituir la muestra por el agregado completo

Se procesaron los cortes **2009, 2012, 2015, 2018, 2021 y 2024**, con las **32 entidades** por año. Se conservaron sexo, grupo de edad y tipo de sección. Los 54,872,712 registros de origen de 192 CSV se consolidaron en **20,755 grupos**, distribuidos como un JSON compacto de **850,227 bytes**.

La inspección y agregación preservaron conteos y procedencia; una auditoría independiente contrastó el agregado contra los originales. Los originales pesados quedan fuera del entregable. La muestra histórica de 150 grupos permanece identificada como `sample` para pruebas; la entrada final utiliza `full`. Ambas no deben sumarse.

Se conservaron las cuatro consultas del backend y se fijaron los indicadores oficiales con denominador **SV+NV**. El backend puede cargar el paquete completo sin editar ni ejecutar el ETL.

### DATA-05 — Matriz de cobertura y catálogo compartido

Se construyó el catálogo `ccpc-capabilities/v1` desde los datos existentes. Enumera años, claves INE, sexo por año, 18 grupos de edad y tres tipos de sección. La matriz contiene **31,104 cruces posibles: 20,755 observados y 10,349 ausentes**. Los CSV anexos enumeran ausencias, cobertura anual y comparaciones.

Frontend y backend utilizan el mismo catálogo y evaluador. El onboarding sólo ofrece solicitudes que pueden responderse con los filtros seleccionados. Una combinación inexistente produce **`no_data` y `result: null`**, nunca cifras imputadas. Un 0% realmente observado conserva `status: 'ok'`.

Las comparaciones requieren datos en cada año solicitado. Se verificaron 77,760 comparaciones atómicas: 51,749 válidas y 26,011 inválidas. `no_binario` sólo está documentado en 2024; su ausencia en años anteriores no equivale a cero.

### DATA-06 — Congelar la versión final 1.0.0

Se etiquetó el dataset como **1.0.0**, se actualizó el diccionario y se crearon el manifiesto, metadatos para frontend, checksums y bloqueo de contratos. El arranque valida **13 artefactos y 14 archivos de contratos/regeneración** contra hashes fijados antes de habilitar consultas.

La versión se congela desde esta entrega, antes del límite del **26 de octubre de 2026, America/Monterrey**. Una modificación de datos o esquema requiere otra versión; el pin 1.0.0 no se recalcula para aceptar archivos distintos. El mecanismo rechaza cambios con independencia de la fecha del reloj.

El release conserva fuente oficial, metodología, fechas y nueve advertencias. El regenerador reconstruyó sus cinco archivos idénticos byte a byte desde las entradas fijadas DATA-04/05. El esquema y los datos congelados no se modifican al actualizar este README; sí se actualizan los inventarios y checksums de distribución afectados.

## Qué requisitos se cumplen

| Tarea | Checklist solicitado | Aceptación verificada |
| --- | --- | --- |
| DATA-04 · **8/8** | Seis años; 32 entidades; sexo/edad/tipo de sección; JSON optimizado; sample/full explícitos; versión/fecha/hash/procedencia; exclusión de originales; cuatro consultas ejecutadas. | Cobertura consultable, cuatro funciones operativas, denominador oficial y consumo sin modificar ETL. |
| DATA-05 · **9/9** | Años; entidades y claves INE; sexo por año; edades; tipos de sección; cruces ausentes; comparaciones inválidas; preguntas fuera de alcance; catálogo JSON. | Catálogo común, onboarding respondible y `no_data` para ausencia. |
| DATA-06 · **9/9** | Etiqueta 1.0.0; SHA-256; diccionario; fuente oficial; extracción; limitaciones; regeneración; validaciones guardadas; revisión de identificadores personales directos. | Congelación verificable, integridad al arrancar, metadatos al frontend y reproducción exacta. |

La comprobación nueva sobre una extracción limpia aprobó **149 pruebas**, TypeScript y las auditorías de datos, cobertura, release y privacidad. Se recalcularon 192 resúmenes entidad/año y se ejecutaron las 10,349 selecciones ausentes: todas devolvieron `no_data`, resultado nulo y cero sugerencias. La prueba HTTP comprobó las cuatro consultas, catálogo compartido, metadatos y un cero observado.

Los criterios se verifican en el módulo y en la demostración incluidos. No se afirma un despliegue dentro de repositorios externos del equipo ni se certifican decisiones humanas futuras de edición. Las aplicaciones reales deben adoptar los puntos de integración siguientes.

## Uso en el backend de Bryan

Incorpora **toda la carpeta `Ine-hacktoon-DATA-06/`** como módulo dentro o junto al backend, preservando rutas, archivos ocultos y bytes. Instala sus dependencias desde esa carpeta; conserva su `package.json` separado del del backend existente.

La entrada final es **`src/data/dataset-v1.ts`**:

```ts
// Ejemplo desde un archivo ESM junto a la carpeta del módulo.
import { createFrozenParticipationService }
  from './Ine-hacktoon-DATA-06/src/data/dataset-v1.ts';

// Crear una vez. Esperar ANTES de listen/readiness.
const ccpc = await createFrozenParticipationService();
const response = ccpc.execute({
  query: 'getParticipationSummary',
  filters: { year: 2024, entityCodes: ['19'] },
});
console.log(response.status, response.release.datasetVersion);
```

Ajusta la ruta del import al archivo del backend, conservando las rutas interiores del módulo. Si la integridad falla, el inicio debe detenerse: no abrir el servidor como disponible ni sustituir los datos por la muestra.

| Consulta | Qué devuelve | Parámetros particulares |
| --- | --- | --- |
| `getParticipationSummary` | Conteos y métricas de la selección. | `filters`. |
| `getParticipationBreakdown` | Desglose por entidad, año, sexo, edad o tipo de sección. | `filters`, `dimension`. |
| `compareElections` | Resumen por corte y cambios descriptivos. | `filters` sin `year`; `years` con dos a seis años únicos. |
| `getSupportingRecords` | Grupos agregados que respaldan la respuesta. | `filters`. |

Los filtros son `year`, `entityCodes`, `sexes`, `ageGroups` y `sectionTypes`. El año es numérico y las claves INE son cadenas de dos dígitos, por ejemplo `'01'` y `'19'`. Listas de una dimensión se combinan con OR; dimensiones diferentes, con AND. Un desglose de un solo año no sustituye una comparación histórica.

## Uso en frontend y onboarding

La integración HTTP de referencia está en `scripts/ccpc/serve-dataset-v1.ts`:

| Endpoint | Función |
| --- | --- |
| `GET /api/capabilities` | Catálogo compartido: `ccpc.getCatalog()`. |
| `GET /api/dataset` | Fuente, metodología, fechas, advertencias y cobertura: `ccpc.getDatasetMetadata()`. |
| `GET /api/release` | Manifiesto 1.0.0 verificado: `ccpc.getRelease()`. |
| `POST /api/query` | Ejecutar el cuerpo JSON mediante `ccpc.execute()`. |

En un frontend TypeScript usa `src/client/coverage-client.ts`. En un navegador sin compilación sirve la copia JavaScript incluida `examples/data05/coverage-client.js`, como hace la demostración. Usa el catálogo recibido, sin mantener otra lista de categorías o reconstruir la matriz.

```js
import { createCatalogClient } from '/coverage-client.js';

const catalogResponse = await fetch('/api/capabilities');
const metadataResponse = await fetch('/api/dataset');
if (!catalogResponse.ok || !metadataResponse.ok) {
  throw new Error('No se pudo cargar el dataset');
}
const client = createCatalogClient(await catalogResponse.json());
const metadata = await metadataResponse.json();
const questions = client.getOnboardingQuestions({year: 2024, entityCodes: ['19']});

if (questions.length) {
  const response = await fetch('/api/query', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(questions[0].request),
  });
  if (!response.ok) throw new Error('No se pudo completar la consulta');
  const envelope = await response.json();
  // Mostrar envelope.status/result y metadata.source/methodology/warnings.
}
```

El backend vuelve a evaluar cada solicitud. Sirve estos endpoints en el mismo origen del frontend o configura el proxy del proyecto. La demostración ya utiliza un solo origen.

Muestra la versión, los enlaces oficiales de `metadata.source`, la metodología, las fechas y las advertencias. Conserva la evidencia y los hashes de las respuestas. `result` varía según la consulta: no todas tienen `totals`.

### Indicadores y ausencia de datos

- Participación oficial: **`ccpcParticipationPct = 100 × SV / (SV+NV)`**.
- Abstención oficial: **`ccpcAbstentionPct = 100 × NV / (SV+NV)`**.
- NS se conserva separado. Los campos heredados `participationPct`, `abstentionPct` y sus tasas sobre LN tienen otro denominador; no deben mostrarse como indicador oficial CCPC.
- En comparaciones oficiales utiliza `ccpcParticipationPercentagePoints` y `ccpcAbstentionPercentagePoints`.
- `no_data` implica `result: null`. Mostrar un estado sin datos; no transformarlo en 0%. Una observación de 0% con denominador positivo sigue siendo válida.
- Se suman conteos antes de dividir. Los denominadores nulos producen métricas nulas, no porcentajes inventados.

## Contenido del ZIP y evidencia

```text
Entrega-final-CCPC-1.0.0/
├── README.md                    # Este proceso, cumplimiento y uso.
├── LEEME-ENTREGA.md              # Arranque breve y responsabilidades.
├── INTEGRACION.md                # Integración detallada para el equipo.
├── AUDITORIA-FINAL.md / .json     # Veredicto y límites de comprobación.
├── MANIFEST-ENTREGA.json         # Inventario del consolidado.
├── evidencias/                  # Nueva auditoría e integración HTTP.
└── Ine-hacktoon-DATA-06/         # Módulo ejecutable completo.
    ├── README.md
    ├── data/ccpc/full/           # Compacto completo y procedencia.
    ├── data/ccpc/catalog/        # Catálogo JSON y matrices CSV.
    ├── data/ccpc/releases/1.0.0/ # Release, diccionario y metadatos.
    ├── src/                     # Dominio, consultas y adaptadores.
    ├── scripts/                 # Validación, auditoría y regeneración.
    ├── tests/                   # Pruebas de las tres etapas.
    └── docs/                    # Contratos, checklists y evidencia previa.
```

Los documentos siguientes están dentro del ZIP: `INTEGRACION.md`, `AUDITORIA-FINAL.md` y `Ine-hacktoon-DATA-06/docs/data04-checklist.md`, `data05-checklist.md`, `data06-checklist.md`. Sus rutas se conservan para revisar cada requisito y sus evidencias.

## Reproducción e integridad

Desde la carpeta del módulo:

```sh
npm run ccpc:release:verify
npm run ccpc:release:audit
npm run ccpc:privacy:audit
npm run ccpc:release:regenerate -- --output /ruta/absoluta/staging-vacio
```

El staging debe estar vacío y fuera del paquete. La regeneración DATA-06 valida el release existente y compara los cinco archivos reconstruidos; no actualiza los pins ni vuelve a leer los 54 millones de registros. El ETL y la guía DATA-04 se conservan para reconstruir conteos desde los ZIP originales anclados; la guía DATA-05 explica el catálogo.

El pin del release es **`5992059695eac4920cf959b1589114d4327e149f237c467c7574d75c4d51d2e4`**. El dato compacto mantiene el SHA-256 **`d7e546928465d25702fe1b625eafb91c8435f7c5ddedd1c30a5278f89c29489c`**. La edición documental modifica los inventarios de distribución y el SHA del ZIP, manteniendo esos pins.

Conserva `.gitattributes`. Excluye el módulo congelado de formateadores automáticos y conversiones de fin de línea: cambian hashes aunque la lógica parezca igual. Una versión nueva requiere revisión y nuevos pins; no se modifica 1.0.0 para hacer pasar archivos diferentes.

## Fuente, fechas y limitaciones

La fuente es el **Instituto Nacional Electoral**, con las URLs de las seis publicaciones y del manual conservadas en el manifiesto y los metadatos. La extracción original se documenta con precisión de día UTC: **2026-10-22**; se preservan las adquisiciones reales y el primer empaquetado DATA-04 a `00:59:19Z`. La hora exacta de extracción de filas no se registró y permanece nula. El release se publicó como snapshot a `2026-10-23T01:44:23Z`, equivalente al 22 de octubre en America/Monterrey.

El agregado no responde por municipio, distrito, sección específica, persona, edad exacta, partido, candidatura, causas ni predicciones. Los cortes electorales no son una serie anual continua ni un panel de las mismas personas. La clasificación territorial puede cambiar entre marcos cartográficos.

La auditoría de 16 archivos de datos/metadatos no detectó identificadores personales directos. Persisten **54 celdas con LN=1 y 124 con LN entre 1 y 4**: no se certifica anonimato absoluto. Los originales pesados, cachés, credenciales y `node_modules` no forman parte de la distribución.

Permanecen dos observaciones históricas no bloqueantes de herramientas DATA-04: su auditor Python aislado es más permisivo que el verificador final y su constructor histórico admite algunas fechas de calendario imposibles. El flujo congelado verifica hashes y rechaza esas alteraciones. Para la entrega final usa el arranque congelado y la cadena completa de validación.
