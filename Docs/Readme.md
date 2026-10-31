# INE Hackathon -- Aseguramiento de Calidad

## Rol: QA / Tester

Responsable de garantizar que el producto final cumpla con los estándares de calidad, accesibilidad y veracidad de datos antes de su presentación. Este rol actua como el filtro de confianza entre lo que el equipo construye y lo que el usuario final recibe.

---

## Responsabilidades

### Validacion y pruebas del producto

- Diseno y ejecucion de **10 casos de aceptacion** que verifican el comportamiento esperado del asistente virtual ante distintos tipos de consultas electorales (comparativas, filtros por entidad, segmentacion demografica, preguntas fuera de alcance, entre otros).
- Construccion de una **matriz de veracidad estadistica** con 10 escenarios de validacion que aseguran que los datos presentados por la IA coincidan con las fuentes oficiales del INE.
- Creacion de un **checklist de accesibilidad y experiencia de usuario** con 13 criterios que evaluan interfaz, lenguaje ciudadano, diseno adaptable y soporte para lectores de pantalla.

### Supervision del proyecto

- Seguimiento continuo del avance de cada rol del equipo (Front-end, Back-end, Data) para asegurar que las implementaciones se alineen con los objetivos del hackathon.
- Definicion de criterios de **Definition of Done** para establecer cuando una funcionalidad se considera terminada y lista para integracion.
- Deteccion y documentacion de desviaciones, errores o inconsistencias durante todo el ciclo de desarrollo.

### Produccion audiovisual y marca

- Creacion del **video promocional** del proyecto, incluyendo la definicion de tiempos, guion y estructura narrativa.
- Diseno de la **mascota del proyecto**, el personaje que representa la identidad visual del asistente virtual en la interfaz y materiales de difusion.

---

## Documentacion generada

| Documento | Descripcion |
| :--- | :--- |
| [Casos de Aceptacion](Qa/acceptance-cases.md) | 10 escenarios de prueba funcional con criterios de aprobacion y fuentes esperadas. |
| [Matriz de Veracidad](Qa/statistical-checklist.md) | Validacion de precision estadistica contra datos oficiales del INE. |
| [Checklist de Accesibilidad](Qa/accesibility-checklist.md) | 13 criterios de interfaz, lenguaje y accesibilidad evaluados. |
| [Definition of Done](Qa/Definition%20of%20Done.md) | Criterios que definen cuando un componente esta completo. |
| [Reporte de Resultados](Qa/test-results.md) | Concentrado de metricas, hallazgos y estado general del proyecto. |

---

## Metodologia de trabajo

1. **Definicion de criterios** -- Se establecieron los casos de aceptacion, la matriz de veracidad y los criterios de accesibilidad antes de iniciar las pruebas.
2. **Ejecucion de pruebas** -- Cada caso se evaluo contra el producto funcional, registrando aprobaciones y rechazos con evidencia.
3. **Registro de hallazgos** -- Los errores detectados se documentaron con severidad y caso asociado para facilitar su correccion por el equipo.
4. **Validacion cruzada** -- Se verifico la coherencia entre los datos que entrega la IA y las fuentes oficiales publicadas por el INE.
5. **Reporte final** -- Se consolido un reporte ejecutivo con metricas de cobertura y estado general del proyecto.
