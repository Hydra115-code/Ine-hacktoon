import { z } from "zod";
import { bindingReferenceSchema, bindingFormatSchema, type BindingFormat } from "../data-binding/schemas/binding-schema.js";
import { optionalNodeIdField, type IdentifiableNode } from "./node-id.js";
import { interactionEventNameSchema } from "./interaction-node.js";

const shortTextSchema = z.string().trim().min(1).max(120);
const fieldSchema = z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_.-]+$/);
const displayFormatSchema = bindingFormatSchema.extract(["number", "percent", "text"]);

interface DataBoundCivicNode extends IdentifiableNode {
  dataBinding: string;
  ariaLabel: string;
}

export interface ElectionDeltaNode extends DataBoundCivicNode {
  type: "electionDelta";
  title: string;
  previousLabelField: string;
  currentLabelField: string;
  previousValueField: string;
  currentValueField: string;
  differenceField?: string;
  differenceUnit?: string;
  format?: BindingFormat;
  unit?: string;
}

export interface TerritoryRankingNode extends DataBoundCivicNode {
  type: "territoryRanking";
  title: string;
  territoryField: string;
  valueField: string;
  valueLabel?: string;
  limit?: number;
  order?: "ascending" | "descending";
  format?: BindingFormat;
  unit?: string;
}

export interface ParticipationTimelineNode extends DataBoundCivicNode {
  type: "participationTimeline";
  title: string;
  periodField: string;
  valueField: string;
  valueLabel?: string;
  format?: BindingFormat;
  unit?: string;
  selectionEvent: string;
}

export interface DataQualityBadgeNode extends DataBoundCivicNode {
  type: "dataQualityBadge";
  title?: string;
  statusField: string;
  labelField?: string;
  recordCountField?: string;
  updatedAtField?: string;
}

export interface DemographicBreakdownNode extends DataBoundCivicNode {
  type: "demographicBreakdown";
  title: string;
  segmentField: string;
  valueField: string;
  valueLabel?: string;
  order?: "ascending" | "descending" | "source";
  format?: BindingFormat;
  unit?: string;
}

export interface ComparisonMatrixNode extends DataBoundCivicNode {
  type: "comparisonMatrix";
  title: string;
  rowField: string;
  columnField: string;
  valueField: string;
  valueLabel?: string;
  maximumColumns?: number;
  format?: BindingFormat;
  unit?: string;
}

export interface EvidenceSummaryNode extends DataBoundCivicNode {
  type: "evidenceSummary";
  title: string;
  numeratorField: string;
  denominatorField: string;
  resultField?: string;
  numeratorLabel?: string;
  denominatorLabel?: string;
  resultLabel?: string;
  format?: BindingFormat;
  unit?: string;
}

export interface CivicInsightNode extends DataBoundCivicNode {
  type: "civicInsight";
  titleField: string;
  explanationField: string;
  statisticField?: string;
  sourceField?: string;
  tone?: "neutral" | "highlight" | "caution";
}

export interface MexicoChoroplethNode extends DataBoundCivicNode {
  type: "mexicoChoropleth";
  id: string;
  title: string;
  entityCodeField: string;
  entityNameField: string;
  valueField: string;
  valueLabel?: string;
  numeratorField?: string;
  denominatorField?: string;
  periodField?: string;
  format?: BindingFormat;
  unit?: string;
  selectionEvent: string;
}

export type CivicNode =
  | ElectionDeltaNode
  | TerritoryRankingNode
  | ParticipationTimelineNode
  | DataQualityBadgeNode
  | DemographicBreakdownNode
  | ComparisonMatrixNode
  | EvidenceSummaryNode
  | CivicInsightNode
  | MexicoChoroplethNode;

const civicBase = {
  ...optionalNodeIdField,
  ariaLabel: shortTextSchema,
  dataBinding: bindingReferenceSchema,
};

export const electionDeltaNodeSchema = z.object({
  type: z.literal("electionDelta"),
  ...civicBase,
  title: shortTextSchema,
  previousLabelField: fieldSchema,
  currentLabelField: fieldSchema,
  previousValueField: fieldSchema,
  currentValueField: fieldSchema,
  differenceField: fieldSchema.optional(),
  differenceUnit: z.string().trim().min(1).max(12).optional(),
  format: displayFormatSchema.optional(),
  unit: z.string().trim().min(1).max(12).optional(),
}).strict();

export const territoryRankingNodeSchema = z.object({
  type: z.literal("territoryRanking"),
  ...civicBase,
  title: shortTextSchema,
  territoryField: fieldSchema,
  valueField: fieldSchema,
  valueLabel: shortTextSchema.optional(),
  limit: z.number().int().min(1).max(32).optional(),
  order: z.enum(["ascending", "descending"]).optional(),
  format: displayFormatSchema.optional(),
  unit: z.string().trim().min(1).max(12).optional(),
}).strict();

export const participationTimelineNodeSchema = z.object({
  type: z.literal("participationTimeline"),
  ...civicBase,
  title: shortTextSchema,
  periodField: fieldSchema,
  valueField: fieldSchema,
  valueLabel: shortTextSchema.optional(),
  format: displayFormatSchema.optional(),
  unit: z.string().trim().min(1).max(12).optional(),
  selectionEvent: interactionEventNameSchema,
}).strict();

export const dataQualityBadgeNodeSchema = z.object({
  type: z.literal("dataQualityBadge"),
  ...civicBase,
  title: shortTextSchema.optional(),
  statusField: fieldSchema,
  labelField: fieldSchema.optional(),
  recordCountField: fieldSchema.optional(),
  updatedAtField: fieldSchema.optional(),
}).strict();

export const demographicBreakdownNodeSchema = z.object({
  type: z.literal("demographicBreakdown"),
  ...civicBase,
  title: shortTextSchema,
  segmentField: fieldSchema,
  valueField: fieldSchema,
  valueLabel: shortTextSchema.optional(),
  order: z.enum(["ascending", "descending", "source"]).optional(),
  format: displayFormatSchema.optional(),
  unit: z.string().trim().min(1).max(12).optional(),
}).strict();

export const comparisonMatrixNodeSchema = z.object({
  type: z.literal("comparisonMatrix"),
  ...civicBase,
  title: shortTextSchema,
  rowField: fieldSchema,
  columnField: fieldSchema,
  valueField: fieldSchema,
  valueLabel: shortTextSchema.optional(),
  maximumColumns: z.number().int().min(2).max(8).optional(),
  format: displayFormatSchema.optional(),
  unit: z.string().trim().min(1).max(12).optional(),
}).strict();

export const evidenceSummaryNodeSchema = z.object({
  type: z.literal("evidenceSummary"),
  ...civicBase,
  title: shortTextSchema,
  numeratorField: fieldSchema,
  denominatorField: fieldSchema,
  resultField: fieldSchema.optional(),
  numeratorLabel: shortTextSchema.optional(),
  denominatorLabel: shortTextSchema.optional(),
  resultLabel: shortTextSchema.optional(),
  format: displayFormatSchema.optional(),
  unit: z.string().trim().min(1).max(12).optional(),
}).strict();

export const civicInsightNodeSchema = z.object({
  type: z.literal("civicInsight"),
  ...civicBase,
  titleField: fieldSchema,
  explanationField: fieldSchema,
  statisticField: fieldSchema.optional(),
  sourceField: fieldSchema.optional(),
  tone: z.enum(["neutral", "highlight", "caution"]).optional(),
}).strict();

export const mexicoChoroplethNodeSchema = z.object({
  type: z.literal("mexicoChoropleth"),
  ...civicBase,
  id: z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/),
  title: shortTextSchema,
  entityCodeField: fieldSchema,
  entityNameField: fieldSchema,
  valueField: fieldSchema,
  valueLabel: shortTextSchema.optional(),
  numeratorField: fieldSchema.optional(),
  denominatorField: fieldSchema.optional(),
  periodField: fieldSchema.optional(),
  format: displayFormatSchema.optional(),
  unit: z.string().trim().min(1).max(12).optional(),
  selectionEvent: interactionEventNameSchema,
}).strict();

export const civicNodeSchemas = [
  electionDeltaNodeSchema,
  territoryRankingNodeSchema,
  participationTimelineNodeSchema,
  dataQualityBadgeNodeSchema,
  demographicBreakdownNodeSchema,
  comparisonMatrixNodeSchema,
  evidenceSummaryNodeSchema,
  civicInsightNodeSchema,
  mexicoChoroplethNodeSchema,
] as const;

export const civicNodeSchema = z.discriminatedUnion("type", civicNodeSchemas);
