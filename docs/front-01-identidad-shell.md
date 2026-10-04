# FRONT-01 · Identidad y shell del INE

Fecha de validación: 3 de octubre de 2026.

## Objetivo

Sustituir la identidad visual y el lenguaje visible de Banorte por una experiencia de exploración ciudadana para el reto del INE, sin modificar contratos, datos ni comportamiento del motor GenUI.

## Cambios aplicados

- Metadata del sitio actualizada a `INE | Explorador ciudadano`.
- Marca propia en código con la leyenda `Datos para comprender`.
- Identificación explícita como `Prototipo Hackathon 2026`.
- Encabezado, acceso, conversación, lienzo, estados y compositor reescritos para datos públicos.
- Nuevas sugerencias orientadas a participación, municipios y patrones territoriales.
- Paleta magenta/cívica con acento azul verdoso, modos claro y oscuro.
- Estados responsivos revisados para escritorio y móvil.
- No se modificaron contratos, fixtures, rutas de datos ni lógica del agente.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Residuos visibles de Banorte en el shell modificado | 0 coincidencias |
| `pnpm typecheck` | Correcto |
| `pnpm build` | Correcto; 25 rutas compiladas |
| `pnpm quality:verify` | 12/12 pruebas correctas |
| Revisión visual 1440 × 900 | Sin recortes ni desbordamientos |
| Revisión visual 390 × 844 | Marca, título y contenido legibles |

## Límite de fase

Las referencias financieras internas siguen presentes porque pertenecen a `FRONT-02`, donde se neutralizarán contratos, nombres de eventos, adaptadores y fixtures sin romper el runtime.
