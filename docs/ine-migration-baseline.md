# Baseline de migración a INE

Este repositorio reutiliza como punto de partida el motor de interfaz generativa desarrollado previamente para Banorte. La importación se realizó como una copia limpia del contenido versionado, sin heredar el historial Git del proyecto anterior.

## Procedencia

- Repositorio fuente local: `/home/erk/Documentos/Moc-Front-main`
- Commit fuente: `5d20b0af92b9ecf19a2ac56b0c28af380eaf67e1`
- Fecha de importación: 3 de octubre de 2026
- Repositorio destino: `git@github.com:Hydra115-code/Ine-hacktoon.git`
- Rama de trabajo: `front-end`

## Alcance de esta tarjeta

- Se importaron exclusivamente archivos rastreados por Git en el commit fuente.
- No se copiaron `.env`, `.env.local`, `node_modules`, `.next`, `dist` ni `coverage`.
- No se incorporó el cambio local generado en `next-env.d.ts`.
- El proyecto Banorte permanece sin modificaciones.
- La neutralización del dominio financiero y el rediseño visual para INE se realizarán en tarjetas posteriores.
