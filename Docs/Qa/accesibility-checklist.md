# Checklist de Accesibilidad, UI y Experiencia de Usuario (QA-01)

Este documento define los criterios de prueba para garantizar que el asistente virtual y la interfaz del proyecto sean accesibles, intuitivos, visualmente claros y fáciles de usar para cualquier ciudadano, resolviendo las barreras de uso del sitio web tradicional.

---

## 1. Interfaz de Usuario y Limpieza Visual (UI)

| ID | Criterio de UI | Descripción y Comportamiento Esperado | Resultado |
| :--- | :--- | :--- | :---: |
| **UI-01** | **Interfaz Limpia y No Saturada** | A diferencia del portal tradicional, la pantalla principal debe mostrar un diseño minimalista enfocado en el chat y la visualización de datos. | [x ] Aprobado<br>[ ] Reprobado |
| **UI-02** | **Componentes de Gráficas Claras** | Las gráficas (barras, pastel, líneas) deben incluir etiquetas legibles, leyendas visibles y colores con contraste adecuado por partido/categoría. | [x ] Aprobado<br>[ ] Reprobado |
| **UI-03** | **Vista de Tablas Interactivas** | Las tablas deben contar con paginación, bordes claros y opción de ordenar columnas sin romper el diseño. | [x ] Aprobado<br>[ ] Reprobado |
| **UI-04** | **Transición Fluida de Vistas** | La alternancia entre gráfica y tabla (solicitada en CA-09) debe ser inmediata y sin parpadeos o fallos gráficos. | [ x] Aprobado<br>[ ] Reprobado |
| **UI-05** | **Identidad de la Mascota / Bot** | La imagen o avatar del asistente debe estar presente en la conversación de manera amigable sin obstruir la lectura de los resultados. | [x ] Aprobado<br>[ ] Reprobado |

---

## 2. Mensajes y Comprensión del Lenguaje (UX)

| ID | Criterio de Lenguaje | Descripción y Comportamiento Esperado | Resultado |
| :--- | :--- | :--- | :---: |
| **UX-01** | **Mensaje Claro y Comprensible** | La IA debe responder en lenguaje ciudadano sencillo, evitando tecnicismos innecesarios o códigos de error crudos. | [ x] Aprobado<br>[ ] Reprobado |
| **UX-02** | **Fuente Visible y Trazabilidad** | Cada respuesta con datos numéricos debe incluir al pie de la tarjeta/mensaje la fuente oficial visible (ej. *Fuente: Cómputos Distritales INE*). | [ x] Aprobado<br>[ ] Reprobado |
| **UX-03** | **Retroalimentación de Carga (Loading States)** | Mientras la IA procesa o consulta las herramientas de datos, debe mostrarse un indicador claro de "pensando" o "generando gráfica". | [x ] Aprobado<br>[ ] Reprobado |
| **UX-04** | **Manejo Amigable de Errores** | Ante preguntas fuera de alcance o fallos de red, el sistema debe orientar al usuario sobre cómo formular una consulta válida. | [ x] Aprobado<br>[ ] Reprobado |

---

## 3. Accesibilidad e Inclusión (a11y)

| ID | Criterio de Accesibilidad | Descripción y Comportamiento Esperado | Resultado |
| :--- | :--- | :--- | :---: |
| **ACC-01** | **Diseño Adaptable (Responsive)** | La interfaz debe ser 100% funcional y legible tanto en laptops como en dispositivos móviles (teléfonos y tabletas). | [x ] Aprobado<br>[ ] Reprobado |
| **ACC-02** | **Contraste de Color Accesible** | El texto y las gráficas deben cumplir con un contraste mínimo de color para facilitar la lectura a personas con baja visión. | [ x] Aprobado<br>[ ] Reprobado |
| **ACC-03** | **Navegación por Teclado** | Es posible navegar entre el campo de texto, botones de consulta y selector de vistas utilizando únicamente la tecla `Tab` y `Enter`. | [ x] Aprobado<br>[ ] Reprobado |
| **ACC-04** | **Soporte para Lectores de Pantalla** | Las gráficas y tablas deben incluir atributos de texto alternativo o descripciones accesibles (ARIA labels). | [x ] Aprobado<br>[ x] Reprobado |

---

## Resumen de Evaluación de Accesibilidad

* **Total de Criterios:** 13
* **Criterios Aprobados:** __13___ / 13
* **Estado General:** [x ] Listo para Producción / [ ] Requiere Ajustes de UI/UX