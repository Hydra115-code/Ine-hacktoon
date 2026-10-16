# Contratos de tools cívicas

Referencia de integración de sólo lectura para el commit backend `ff192b82032de5d06f12ea68f8e70b1a2f3c09fd`.

## Campos comunes

Las cuatro respuestas incluyen:

| Campo | Tipo | Regla |
|---|---|---|
| `dataType` | `"OBSERVED"` | Identifica datos observados. |
| `isSampleData` | boolean | Si es `true`, la UI debe advertir que no son cifras oficiales. |
| `source` | objeto | `name` obligatorio; `url` y `note` opcionales. |
| `metadata.queriedAt` | fecha ISO | Hora declarada por el backend. |

## `get_participation_summary`

Entrega proceso, nivel, entidad, resultados por opción y participación agregada con lista nominal, personas que votaron, participación y abstención. No entrega metodología separada; el frontend no debe inventarla.

## `compare_elections`

Entrega exactamente dos procesos, diferencia en puntos porcentuales y `methodologyNotes`. Los años vienen ordenados por el servicio aunque la entrada llegue invertida.

## `get_participation_breakdown`

Entrega grupos por `entidad`, `sexo` o `grupo_edad`. `coverageNote` es opcional y debe mostrarse cuando indique cobertura parcial.

## `get_supporting_records`

Entrega registros de evidencia con `dato_fuente` o `calculado`. Los campos calculados pueden incluir `derivation`; el frontend debe conservarla para explicar el cálculo.

## Política de adaptación

- Validar primero el payload completo con Zod.
- Preservar números, etiquetas, fuente y metodología sin recalcularlos.
- Si algunos elementos de una colección son inválidos, conservar únicamente los elementos válidos y marcar la respuesta como parcial.
- Si no queda evidencia válida, rechazar la respuesta y no renderizar cifras.
- Nunca completar periodos, entidades, porcentajes, fuente o metodología ausentes.
- La terminología `financial.*` no participa en estos adaptadores.
