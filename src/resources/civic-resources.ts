import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CIVIC_TOOL_NAMES } from "../agent/civic-tool-policy.js";
import { BREAKDOWN_DIMENSIONS, ELECTION_OFFICES } from "../schemas/civic.schema.js";

/**
 * Recursos MCP: documentos de referencia de sólo lectura que el agente puede
 * consultar para explicar bien las cifras (qué significa cada métrica y qué
 * cubren los datos).
 */

const MetricDefinitionSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  calculation: z.string().min(1),
  unit: z.enum(["count", "percentage", "percentage_points"]),
  sourceTools: z.array(z.enum(CIVIC_TOOL_NAMES)).min(1),
});

const CivicResourceContentSchema = z.discriminatedUnion("kind", [
  z.object({
    schemaVersion: z.literal("1.0"),
    kind: z.literal("metric-definitions"),
    definitions: z.array(MetricDefinitionSchema).min(1),
  }),
  z.object({
    schemaVersion: z.literal("1.0"),
    kind: z.literal("coverage"),
    levels: z.array(z.string().min(1)).min(1),
    offices: z.array(z.string().min(1)).min(1),
    breakdownDimensions: z.array(z.string().min(1)).min(1),
    notIncluded: z.array(z.string().min(1)),
    rules: z.array(z.string().min(1)),
  }),
]);

type CivicResourceContent = z.infer<typeof CivicResourceContentSchema>;

interface ResourceDefinition {
  name: string;
  uri: `civic://${string}`;
  title: string;
  description: string;
  content: CivicResourceContent;
}

const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  {
    name: "civic-metric-definitions",
    uri: "civic://metric-definitions",
    title: "Definiciones de métricas electorales",
    description: "Qué significa y cómo se calcula cada cifra que devuelven las tools cívicas.",
    content: CivicResourceContentSchema.parse({
      schemaVersion: "1.0",
      kind: "metric-definitions",
      definitions: [
        {
          name: "nominalList",
          label: "Lista nominal",
          description: "Personas inscritas que pueden votar en ese proceso y territorio.",
          calculation: "Dato de la fuente.",
          unit: "count",
          sourceTools: ["get_participation_summary", "compare_elections", "get_participation_breakdown", "get_supporting_records"],
        },
        {
          name: "totalVotes",
          label: "Votos totales",
          description: "Votos emitidos en el proceso.",
          calculation: "Suma de los votos de cada partido.",
          unit: "count",
          sourceTools: ["get_participation_summary", "compare_elections", "get_supporting_records"],
        },
        {
          name: "turnoutPercentage",
          label: "Participación",
          description: "Proporción de la lista nominal que votó.",
          calculation: "100 × votos totales ÷ lista nominal",
          unit: "percentage",
          sourceTools: ["get_participation_summary", "compare_elections", "get_participation_breakdown", "get_supporting_records"],
        },
        {
          name: "abstentionPercentage",
          label: "Abstención",
          description: "Proporción de la lista nominal que no votó.",
          calculation: "100 − participación",
          unit: "percentage",
          sourceTools: ["get_participation_summary"],
        },
        {
          name: "percentage",
          label: "Porcentaje de votos",
          description: "Proporción de los votos totales que obtuvo cada partido.",
          calculation: "100 × votos del partido ÷ votos totales",
          unit: "percentage",
          sourceTools: ["get_participation_summary", "compare_elections"],
        },
        {
          name: "turnoutChange.points",
          label: "Cambio de participación",
          description: "Diferencia entre dos participaciones. Se expresa en puntos porcentuales: de 61 % a 58 % son −3 puntos, no −3 %.",
          calculation: "participación del año posterior − participación del año anterior",
          unit: "percentage_points",
          sourceTools: ["compare_elections"],
        },
      ],
    }),
  },
  {
    name: "civic-coverage",
    uri: "civic://coverage",
    title: "Cobertura de los datos",
    description: "Qué niveles, cargos y desgloses están disponibles y qué reglas seguir al presentarlos.",
    content: CivicResourceContentSchema.parse({
      schemaVersion: "1.0",
      kind: "coverage",
      levels: ["Nacional", "Entidad federativa"],
      offices: [...ELECTION_OFFICES],
      breakdownDimensions: [...BREAKDOWN_DIMENSIONS],
      notIncluded: ["Municipio", "Distrito", "Sección", "Datos personales de votantes"],
      rules: [
        "Citar siempre la fuente de cada cifra.",
        "No comparar un estado contra el total nacional como si fueran equivalentes.",
        "Mostrar el numerador y el denominador junto a cada porcentaje.",
        "No describir datos agregados como si fueran decisiones de personas individuales.",
        "Los datos de ejemplo no deben presentarse como resultados oficiales.",
      ],
    }),
  },
];

export const CIVIC_RESOURCE_COUNT = RESOURCE_DEFINITIONS.length;

export function registerCivicResources(server: McpServer): void {
  for (const definition of RESOURCE_DEFINITIONS) {
    server.registerResource(
      definition.name,
      definition.uri,
      {
        title: definition.title,
        description: definition.description,
        mimeType: "application/json",
      },
      async () => ({
        contents: [
          {
            uri: definition.uri,
            mimeType: "application/json",
            text: JSON.stringify(definition.content),
          },
        ],
      }),
    );
  }
}
