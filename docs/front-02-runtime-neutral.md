# FRONT-02 · Runtime GenUI neutral

Estado: **cerrada y validada técnicamente el 3 de octubre de 2026**.

## Objetivo

Conservar el motor generativo validado y eliminar del núcleo las decisiones propias de banca antes de introducir datos electorales. Esta tarjeta no crea todavía la primera historia del INE; eso corresponde a `FRONT-03`.

## Cambios realizados

- El paquete compartido ahora se llama `@ine/contracts`.
- El entrypoint principal exporta únicamente protocolo, DSL, data registry, UI patches y tipos neutrales.
- Los contratos financieros anteriores quedaron aislados en `@ine/contracts/legacy-financial` para no romper los harnesses históricos mientras se reemplazan.
- Los estados semánticos cambiaron de `financial.*` a `data.*`.
- La máquina de experiencia modela `action` y eventos `ACTION_*`, no pagos.
- La política de interacción distingue cambios locales, análisis, simulaciones y acciones autoritativas bloqueadas.
- El planner usa ejemplos de datos públicos, indicadores, periodos y territorios.
- Las gráficas y tablas sólo formatean moneda o porcentajes cuando la especificación lo declara; ya no lo infieren por nombres financieros de campos.
- La protección de identificadores se generalizó para credenciales, CURP, OCR, tokens, teléfonos y campos heredados sensibles.
- Cookies, eventos del navegador y snapshots usan el namespace `ine`.

## Contrato conservado

El ciclo sigue siendo:

```text
consulta → stream → data registry → UI specification → renderer
         → UIEvent → patch/version nueva → reconciliación de estado
```

Se conservaron las revisiones de UI y datos, IDs estables, validación Zod, recuperación de snapshots, deduplicación de eventos, streaming incremental y bloqueo de acciones autoritativas.

## Evidencia automatizada

```bash
pnpm front-02:verify
pnpm typecheck
pnpm protocol:verify
pnpm runtime:verify
pnpm dynamic-ui:verify
pnpm quality:verify
pnpm build
```

`scripts/front-02-domain-neutrality.test.mjs` impide que el runtime principal vuelva a incorporar `@banorte/contracts`, estados `financial.*`, eventos `PAYMENT_*`, tipos `PaymentStatus` o namespaces del navegador de Banorte.

## Límite deliberado

Los fixtures y harnesses bancarios de desarrollo no son parte del runtime productivo. Se conservan como regresión temporal y serán sustituidos/retirados al implementar `FRONT-03`; no se usan como plantillas para generar interfaces del INE.
