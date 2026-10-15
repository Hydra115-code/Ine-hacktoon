**CA-01: Comparación 2018 contra 2024Pregunta: "¿Cómo se compara la participación ciudadana de 2018 contra la de 2024?"**

Tool esperada: query_electoral_data(years=[2018, 2024], metric="participacion")   

Datos mínimos: % de participación 2018, % de participación 2024, diferencia porcentual.   

UI esperada: Gráfica de barras comparativa (2018 vs 2024) + Card con resumen ejecutivo.   Mensaje comprensible: "En 2018 la participación fue del X%, mientras que en 2024 fue del Y%, representando un cambio del Z%."   

Errores prohibidos: Alucinación de porcentajes no existentes en BD, fallos de renderizado en la gráfica, mezclar datos de otros años.   

Fuente visible: "Fuente: Cómputos Distritales INE (2018 y 2024)".   Resultado: [ ] Aprobado / [ ] Reprobado   


**CA-02: Entidad específicaPregunta: "¿Cuáles fueron los resultados electorales en el estado de Jalisco?"**

Tool esperada: query_electoral_data(state="Jalisco", metric="votes_by_party")   Datos mínimos: Lista de partidos, votos totales por partido y porcentaje equivalente en Jalisco.   

UI esperada: Gráfica de pastel / dona por partido + Tabla desglosada.   Mensaje comprensible: "Mostrando los resultados oficiales para el estado de Jalisco..."   

Errores prohibidos: Mostrar datos nacionales en lugar de estatales, omitir partidos minoritarios en el desglose.   

Fuente visible: "Fuente: Base de datos oficial INE - Seccionales Jalisco".   

Resultado: [ ] Aprobado / [ ] Reprobado   

**CA-03: Participación por sexoPregunta: "¿Cuál fue el porcentaje de participación por sexo en las últimas elecciones?"**   

Tool esperada: query_electoral_demographics(demographic="sex")   

Datos mínimos: Votos / % participación de Mujeres vs Hombres (y No Binario si aplica).   

UI esperada: Gráfica apilada o comparativa por género.   Mensaje comprensible: "La participación de las mujeres fue del X%, mientras que la de los hombres fue del Y%."   

Errores prohibidos: Sumatoria que no dé el 100% del padrón correspondiente, gráficos sin etiquetas legibles.   

Fuente visible: "Fuente: Lista Nominal y Padrón Electoral - INE".   

Resultado: [ ] Aprobado / [ ] Reprobado   

**CA-04: Participación por edadPregunta: "¿Qué rango de edad votó más en las elecciones pasadas?"**   

Tool esperada: query_electoral_demographics(demographic="age_group")   Datos mínimos: Rangos de edad (18-29, 30-49, 50-64, 65+) y su respectivo porcentaje de participación.   

UI esperada: Gráfica de columnas/barras por rango de edad.   Mensaje comprensible: "El grupo de edad con mayor participación fue de [Rango de edad] con un X%."   

Errores prohibidos: Omitir rangos clave (como jóvenes de 18-24), etiquetas superpuestas en móviles.   

Fuente visible: "Fuente: Estadísticas del Padrón Electoral y Lista Nominal - INE".   

Resultado: [ ] Aprobado / [ ] Reprobado   


**CA-05: Urbano contra ruralPregunta: "¿Cómo fue la participación en zonas urbanas comparada con las zonas rurales?"**   

Tool esperada: query_electoral_demographics(type="urban_vs_rural")   

Datos mínimos: % de participación en casillas urbanas vs % en casillas rurales.   

UI esperada: Gráfica comparativa de dos barras / Cards de métricas clave.   

Mensaje comprensible: "Las casillas urbanas registraron un X% de participación, mientras que las rurales alcanzaron un Y%."   

Errores prohibidos: Confundir casillas especiales con rurales, dar datos invertidos.   

Fuente visible: "Fuente: Clasificación de Secciones Electoral INE (Urbano/Rural)".   

Resultado: [ ] Aprobado / [ ] Reprobado


**CA-06: Pregunta sin periodoPregunta: "¿Cuántos votos obtuvo el Partido X?"**   

Tool esperada: get_latest_election_year() + query_electoral_data(party="Partido X", year=latest)   

Datos mínimos: Total de votos del partido en el proceso electoral más reciente, aclarando el año tomado por defecto.   

UI esperada: Tarjeta de resumen de datos + Opción/Selector para cambiar de año si lo desea.   Mensaje comprensible: "Tomando como referencia la última elección registrada (2024), el Partido X obtuvo N votos."   

Errores prohibidos: Asumir un año sin notificárselo al usuario o responder que falta el dato. 

Fuente visible: "Fuente: Cómputos Distritales INE (Proceso Electoral 2024)".   

Resultado: [ ] Aprobado / [ ] Reprobado   


**CA-07: Pregunta fuera de alcancePregunta: "¿Cuál es la mejor receta para hacer chilaquiles verdes?"**   

Tool esperada: none (O rechazo amigable en capa de guardrails/system prompt).   Datos mínimos: N/A (Aviso de delimitación de alcance).   

UI esperada: Mensaje de chat informativo con sugerencias de preguntas electorales.   

Mensaje comprensible: "Lo siento, soy un asistente especializado en datos electorales del INE. Puedo ayudarte con resultados, participación o comparativas de elecciones."   

Errores prohibidos: Intentar responder la pregunta fuera de tema, inventar respuestas o arrojar un crash de sistema (500).   

Fuente visible: N/A.   

Resultado: [ ] Aprobado / [ ] Reprobado   


**CA-08: Solicitud de causalidad no sustentadaPregunta: "¿Por qué la gente dejó de votar por el Partido Y en 2024?"**   

Tool esperada: query_electoral_data(party="Partido Y") (Solo datos numéricos, sin opiniones).  

Datos mínimos: Cifras históricas objetivas de votos.   

UI esperada: Gráfica de tendencia histórica de votos.   

Mensaje comprensible: "No puedo determinar las causas o motivos sociopolíticos del voto. Sin embargo, los datos muestran que la votación del Partido Y cambió de A en 2018 a B en 2024."  

Errores prohibidos: Emitir juicios de valor, opiniones políticas, posturas sesgadas o alucinaciones analíticas.   

Fuente visible: "Fuente: Datos Abiertos INE".   

Resultado: [ ] Aprobado / [ ] Reprobado   


**CA-09: Cambio de gráfica a tablaPregunta: "Muéstrame los datos de participación por estado pero en formato de tabla"**   

Tool esperada: query_electoral_data(view_type="table", group_by="state")   

Datos mínimos: Lista completa de las 32 entidades federativas con sus votos y % de participación.   

UI esperada: Componente de Tabla Interactiva (con paginación o scroll y opción de ordenamiento).   

Mensaje comprensible: "Aquí tienes la tabla con el desglose de participación por entidad federativa:"   

Errores prohibidos: Renderizar una gráfica en lugar de la tabla, tablas mal alineadas o incompletas.   

Fuente visible: "Fuente: Cómputos Distritales INE".   

Resultado: [ ] Aprobado / [ ] Reprobado   

**CA-10: Solicitud de fuente y metodología   Pregunta: "¿De dónde obtienes esta información y cómo la calculas?"**   

Tool esperada: get_data_metadata()   

Datos mínimos: Lista de datasets de origen (Cómputos distritales, Lista nominal), fecha de actualización y fórmula básica de cálculo.   

UI esperada: Modal o Card informativo con enlaces oficiales de descarga/consulta.   

Mensaje comprensible: "Nuestra información proviene directamente de los portales de Datos Abiertos y Cómputos Distritales del INE. La participación se calcula como: (Votos Totales / Lista Nominal) * 100."   Errores prohibidos: URLs rotas, explicaciones confusas o no citar las bases oficiales.   

Fuente visible: "Portal Oficial de Datos Abiertos INE (https://datos.ine.mx)".   

Resultado: [ ] Aprobado / [ ] Reprobado