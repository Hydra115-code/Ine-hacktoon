import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CIVIC_TOOL_NAMES } from "../agent/civic-tool-policy.js";
import { CCPC_YEARS } from "../application/ports/civic-data.js";
import { BREAKDOWN_DIMENSIONS } from "../schemas/civic.schema.js";

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
    years: z.array(z.number().int()).min(1),
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

const ALL_TOOLS = [...CIVIC_TOOL_NAMES];

const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  {
    name: "civic-metric-definitions",
    uri: "civic://metric-definitions",
    title: "Definiciones de métricas de participación (CCPC)",
    description: "Qué significa y cómo se calcula cada cifra que devuelven las tools cívicas.",
    content: CivicResourceContentSchema.parse({
      schemaVersion: "1.0",
      kind: "metric-definitions",
      definitions: [
        {
          name: "nominalList",
          label: "Lista nominal (LN)",
          description: "Personas en la lista nominal de las casillas catalogadas para ese grupo.",
          calculation: "Dato de la fuente.",
          unit: "count",
          sourceTools: ALL_TOOLS,
        },
        {
          name: "voted",
          label: "Votaron (SV)",
          description: "Registros con marca de voto.",
          calculation: "Dato de la fuente.",
          unit: "count",
          sourceTools: ALL_TOOLS,
        },
        {
          name: "didNotVote",
          label: "No votaron (NV)",
          description: "Registros sin marca de voto.",
          calculation: "Dato de la fuente.",
          unit: "count",
          sourceTools: ALL_TOOLS,
        },
        {
          name: "unspecified",
          label: "No especificado (NS)",
          description: "Registros con participación no especificada. No es abstención.",
          calculation: "Dato de la fuente.",
          unit: "count",
          sourceTools: ALL_TOOLS,
        },
        {
          name: "participationPct",
          label: "Participación oficial CCPC",
          description: "Proporción que votó entre quienes tienen marca clasificada (sin contar NS).",
          calculation: "100 × SV ÷ (SV + NV)",
          unit: "percentage",
          sourceTools: ALL_TOOLS,
        },
        {
          name: "nominalParticipationPct",
          label: "Participación nominal",
          description: "Proporción de la lista nominal que votó.",
          calculation: "100 × SV ÷ LN",
          unit: "percentage",
          sourceTools: ALL_TOOLS,
        },
        {
          name: "abstentionPct",
          label: "Abstención oficial CCPC",
          description: "Proporción que no votó entre quienes tienen marca clasificada.",
          calculation: "100 × NV ÷ (SV + NV)",
          unit: "percentage",
          sourceTools: ALL_TOOLS,
        },
        {
          name: "changes.participationPoints",
          label: "Cambio de participación",
          description: "Diferencia entre dos participaciones. Se expresa en puntos porcentuales: de 61 % a 58 % son −3 puntos, no −3 %.",
          calculation: "participación del año posterior − participación del año base",
          unit: "percentage_points",
          sourceTools: ["compare_elections"],
        },
      ],
    }),
  },
  {
    name: "civic-coverage",
    uri: "civic://coverage",
    title: "Cobertura de los datos CCPC",
    description: "Qué años, niveles y desgloses están disponibles y qué reglas seguir al presentarlos.",
    content: CivicResourceContentSchema.parse({
      schemaVersion: "1.0",
      kind: "coverage",
      levels: ["Entidad federativa", "Nacional (suma de entidades)"],
      years: [...CCPC_YEARS],
      breakdownDimensions: [...BREAKDOWN_DIMENSIONS],
      notIncluded: ["Votos por partido o candidatura", "Municipio", "Distrito", "Sección", "Datos personales de votantes"],
      rules: [
        "Citar siempre la fuente de cada cifra.",
        "Primero se suman conteos y después se calculan porcentajes; no promediar porcentajes.",
        "No especificado (NS) no es abstención y no se suma a quienes no votaron.",
        "Ausencia de datos no es cero: un resultado sin datos se presenta como sin datos.",
        "No comparar un estado contra el total nacional como si fueran equivalentes.",
        "Mostrar el numerador y el denominador junto a cada porcentaje.",
        "Las elecciones no son un panel de las mismas personas: una comparación no prueba causas.",
        "No describir datos agregados como si fueran decisiones de personas individuales.",
        "Los datos de muestra no deben presentarse como totales estatales o nacionales.",
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
