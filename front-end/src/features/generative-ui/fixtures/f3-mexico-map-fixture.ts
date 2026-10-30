import { dataRegistrySchema, uiSpecificationSchema } from "@ine/contracts";
import mexicoMapAsset from "../geography/mexico-states.paths.json" with { type: "json" };

export const f3MexicoMapRows = mexicoMapAsset.states.map((state, index) => {
  const nominalList = 120_000 + index * 8_750;
  const participation = Number((46.2 + (index * 7 % 23) + (index % 3) * 0.7).toFixed(1));
  return {
    entityCode: state.code,
    entity: state.name,
    period: "Escenario de laboratorio 2024",
    participation,
    nominalList,
    votesObserved: Math.round(nominalList * participation / 100),
  };
});

export const f3MexicoMapData = dataRegistrySchema.parse({
  mexicoParticipation: f3MexicoMapRows,
  quality: {
    status: "sample",
    label: "Valores sintéticos; geometría oficial de las 32 entidades",
    recordCount: f3MexicoMapRows.length,
    updatedAt: "17 oct 2026",
  },
});

export const f3MexicoMapSpecification = uiSpecificationSchema.parse({
  version: "1",
  root: {
    type: "section",
    id: "f3-mexico-map-view",
    ariaLabel: "Laboratorio del mapa electoral de México",
    surface: "primary",
    padding: "md",
    children: [
      { type: "heading", id: "f3-title", content: "La participación cambia según el territorio", level: 2, size: "title" },
      { type: "text", id: "f3-summary", content: "Explora cada entidad con el mapa, el buscador o la tabla alternativa. Seleccionar un territorio emite una intención que la GenUI puede usar para profundizar.", tone: "secondary" },
      {
        type: "dataQualityBadge",
        id: "f3-quality",
        ariaLabel: "Cobertura y naturaleza de los datos del mapa",
        title: "Cobertura del laboratorio",
        dataBinding: "quality",
        statusField: "status",
        labelField: "label",
        recordCountField: "recordCount",
        updatedAtField: "updatedAt",
      },
      {
        type: "mexicoChoropleth",
        id: "f3-mexico-choropleth",
        ariaLabel: "Mapa interactivo de participación por entidad federativa",
        title: "Participación por entidad",
        dataBinding: "mexicoParticipation",
        entityCodeField: "entityCode",
        entityNameField: "entity",
        valueField: "participation",
        valueLabel: "Porcentaje de participación del escenario de laboratorio",
        numeratorField: "votesObserved",
        denominatorField: "nominalList",
        periodField: "period",
        format: "number",
        unit: "%",
        selectionEvent: "map.entity_selected",
      },
      {
        type: "alert",
        id: "f3-warning",
        title: "Cómo leer esta prueba",
        message: "La forma de las entidades proviene del Marco Geoestadístico de INEGI. Los porcentajes son sintéticos y no deben interpretarse como resultados oficiales.",
        semanticState: "status.warning",
      },
    ],
  },
});
