import {
  MAX_UI_NODES,
  MAX_UI_VISUALIZATIONS,
  UI_DSL_VERSION,
} from "../../generative-ui/schemas/ui-specification";
import { MAX_LAYOUT_CHILDREN, MAX_LAYOUT_DEPTH } from "../../generative-ui/schemas/layout-node";
import { MAX_LOGIC_NESTING, MAX_REPEAT_ITERATIONS } from "../../generative-ui/schemas/logic-node";
import { MAX_TABLE_COLUMNS } from "../../generative-ui/schemas/table-node";
import { CIVIC_COMPOSITION_RECIPES, civicComponentTypes } from "./civic-composition-policy";

export const UI_RUNTIME_CAPABILITIES = {
  schemaVersion: UI_DSL_VERSION,
  layouts: {
    container: ["size", "padding", "children"],
    section: ["ariaLabel", "surface", "padding", "children"],
    stack: ["gap", "align", "children"],
    grid: ["columns", "gap", "align", "children"],
    flex: ["direction", "wrap", "justify", "align", "gap", "children"],
    split: ["ratio", "collapseAt", "gap", "children"],
    scrollable: ["ariaLabel", "axis", "maxSize", "children"],
    divider: ["orientation", "strength"],
    tabs: ["ariaLabel", "defaultValue", "items"],
    accordion: ["mode", "defaultOpen", "items"],
  },
  layoutOptions: {
    gap: ["none", "xs", "sm", "md", "lg", "xl"],
    padding: ["none", "sm", "md", "lg"],
    alignment: ["start", "center", "end", "stretch"],
    gridColumns: [1, 2, 3, 4],
  },
  content: {
    text: ["content", "variant", "tone", "align"],
    heading: ["content", "level", "size", "align"],
    metric: ["label", "labelBinding", "valueBinding", "format", "trendBinding", "comparisonBinding", "importance", "semanticState"],
    badge: ["label", "semanticState", "emphasis"],
    alert: ["title", "message", "semanticState"],
    progress: ["label", "valueBinding", "semanticState", "showValue"],
    icon: ["name", "label", "size", "semanticState"],
    list: ["ordered", "items"],
  },
  civicComponents: {
    allowed: civicComponentTypes,
    electionDelta: ["title", "dataBinding", "previousLabelField", "currentLabelField", "previousValueField", "currentValueField", "differenceField", "format", "unit", "ariaLabel"],
    territoryRanking: ["title", "dataBinding", "territoryField", "valueField", "valueLabel", "limit", "order", "format", "unit", "ariaLabel"],
    participationTimeline: ["title", "dataBinding", "periodField", "valueField", "valueLabel", "format", "unit", "ariaLabel"],
    dataQualityBadge: ["title", "dataBinding", "statusField", "labelField", "recordCountField", "updatedAtField", "ariaLabel"],
    demographicBreakdown: ["title", "dataBinding", "segmentField", "valueField", "valueLabel", "order", "format", "unit", "ariaLabel"],
    comparisonMatrix: ["title", "dataBinding", "rowField", "columnField", "valueField", "valueLabel", "maximumColumns", "format", "unit", "ariaLabel"],
    evidenceSummary: ["title", "dataBinding", "numeratorField", "denominatorField", "resultField", "numeratorLabel", "denominatorLabel", "resultLabel", "format", "unit", "ariaLabel"],
    civicInsight: ["dataBinding", "titleField", "explanationField", "statisticField", "sourceField", "tone", "ariaLabel"],
    mexicoChoropleth: ["title", "dataBinding", "entityCodeField", "entityNameField", "valueField", "valueLabel", "numeratorField", "denominatorField", "periodField", "format", "unit", "selectionEvent", "ariaLabel"],
    recipes: CIVIC_COMPOSITION_RECIPES,
    compositionRules: [
      "choose one primary component and no more than two supporting components",
      "explicit presentation requests such as only table or without chart override the default recipe",
      "comparisonMatrix is the accessible tabular alternative for cross-period or cross-territory evidence",
      "mexicoChoropleth is preferred for explicitly geographic questions and always includes its own accessible table alternative",
      "dataQualityBadge describes coverage; it never substitutes the analytical result",
      "never bind a civic component to fields that were not returned by a connected tool",
    ],
  },
  dataDisplay: {
    table: ["ariaLabel", "caption", "dataBinding", "columns", "sorting", "filtering", "pagination", "selection", "density", "stickyHeader"],
  },
  visualizations: {
    node: "visualization",
    marks: ["line", "area", "bar", "grouped-bar", "stacked-bar", "scatter", "donut", "heatmap"],
    channels: ["x", "y", "value", "group"],
    channelTypes: ["nominal", "ordinal", "quantitative", "temporal"],
    aggregations: ["none", "sum", "average", "min", "max", "count"],
    rules: [
      "line, area, bar, grouped-bar, stacked-bar and scatter require x and quantitative y",
      "grouped-bar and stacked-bar require group",
      "donut requires group and quantitative value",
      "heatmap requires x, y and quantitative value",
    ],
  },
  interactions: [
    "button",
    "input",
    "numberInput",
    "select",
    "multiSelect",
    "slider",
    "datePicker",
    "dateRange",
    "checkbox",
    "switch",
    "radioGroup",
  ],
  logic: {
    nodes: ["repeat", "conditional"],
    operators: ["==", "!=", "<", "<=", ">", ">=", "contains", "exists", "notExists"],
  },
  bindings: {
    registry: "JSON data object supplied beside the specification",
    references: "dot-separated paths; use $item and $index only inside repeat",
  },
  streaming: {
    lifecycle: ["ui-started", "ui-patch", "ui-completed"],
    patchOperations: ["add", "remove", "replace", "update", "move"],
    identity: "every node uses a stable unique kebab-case id",
    versions: "each patch baseRevision must match the current revision and advance revision by exactly one",
  },
  interactionContract: {
    requiredFields: ["id", "label", "event"],
    eventPattern: "namespaced.event_name",
    behavior: "events express intent only; the agent chooses data and MCP tools; never include tool names, handlers or executable code",
    response: "return validated data parts and versioned UI patches correlated with the source node",
  },
  limits: {
    nodes: MAX_UI_NODES,
    visualizations: MAX_UI_VISUALIZATIONS,
    layoutDepth: MAX_LAYOUT_DEPTH,
    childrenPerLayout: MAX_LAYOUT_CHILDREN,
    logicNesting: MAX_LOGIC_NESTING,
    repeatIterations: MAX_REPEAT_ITERATIONS,
    tableColumns: MAX_TABLE_COLUMNS,
  },
} as const;

export type UIRuntimeCapabilities = typeof UI_RUNTIME_CAPABILITIES;
