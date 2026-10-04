# FRONT-03 · Primera historia electoral sin mocks

Estado: **cerrada y validada técnicamente el 3 de octubre de 2026**.

## Decisión de alcance

El equipo de Data todavía no ha entregado un dataset ni un contrato definitivo. Para evitar que el frontend consolide nombres de campos, cifras o territorios inventados, esta fase implementa la experiencia de entrada y las reglas de composición, pero no incluye datos electorales mock.

## Historia preparada

La experiencia permite iniciar una exploración desde tres intenciones complementarias:

- evolución de participación entre periodos disponibles;
- comparación de territorios equivalentes;
- revisión de patrones con registros y fuentes visibles.

Las intenciones llenan el borrador del chat; no seleccionan una pantalla prearmada. El agente sigue decidiendo la composición mediante la DSL neutral y el renderer GenUI.

## Comportamiento sin fuente conectada

- No se muestran KPIs, porcentajes, mapas, gráficas ni tablas vacías como si fueran resultados.
- No se sustituyen faltantes por ceros.
- No se inventan procesos, años, municipios o tendencias.
- El planner debe producir un estado vacío/no disponible honesto y sugerir cómo precisar la consulta.
- Cuando Data entregue filas válidas, el runtime existente podrá renderizar métricas, gráficas, tablas y controles mediante bindings.

## Implementación

- `src/features/electoral-exploration/electoral-exploration-intents.ts`: intenciones y prompts sin resultados.
- `src/features/electoral-exploration/components/ElectoralExplorationStart.tsx`: entrada accesible y responsiva.
- `src/app/dev/electoral-story-harness`: validación visual independiente de backend y autenticación.
- `scripts/front-03-electoral-story.test.ts`: gate contra cifras electorales simuladas.
- `src/features/agent/planner/ui-planner.ts`: regla explícita para no fabricar datos cuando una herramienta no devuelve filas.

## Validación

```bash
pnpm front-03:verify
pnpm typecheck
pnpm build
```

Validación visual realizada sobre `/dev/electoral-story-harness`:

| Vista | Resultado |
|---|---|
| Escritorio, 1440 × 900 | Tres intenciones visibles, jerarquía clara y sin desbordamiento |
| Móvil, 390 × 844 | Una tarjeta por fila, contenido legible y desplazamiento vertical natural |
| Ruta independiente | HTTP 200 sin backend, autenticación ni dataset |

La siguiente integración deberá reemplazar únicamente la procedencia y bindings de datos; no la navegación inicial, el renderer, el streaming ni el ciclo conversacional.
