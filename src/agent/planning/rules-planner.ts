import { CCPC_YEARS } from "../../application/ports/civic-data.js";
import {
  type CompareElectionsOutput,
  type GetParticipationBreakdownOutput,
  type GetParticipationSummaryOutput,
  type GetSupportingRecordsOutput,
} from "../../schemas/civic.schema.js";
import { parseUiDocument, type UiDocument } from "../../ui/dsl/ui.schema.js";
import { createCivicUiFallback } from "../../ui/generation/civic-ui-fallback.js";
import { composeCivicUi } from "../../ui/generation/civic-ui-composer.js";
import { type UiGenerationInput } from "../../ui/generation/ui-generator.js";
import { type AgentToolResult } from "../schemas/agent.schema.js";
import {
  BREAKDOWN_TOOL,
  COMPARE_TOOL,
  planToolCalls,
  SUMMARY_TOOL,
  SUPPORTING_TOOL,
  type CivicPlan,
} from "./civic-plan.js";
import { type CivicQueryInterpreter } from "./civic-query-interpreter.js";
import {
  PlannerProviderError,
  UiCompositionError,
  type PlannerResult,
  type UiPlannerMode,
} from "./planner-result.js";
import { type PlannerSession, type PlannerSessionInput, type UiPlanner } from "./ui-planner.js";

const METHODOLOGY_ANSWER = [
  "Los Conteos Censales de Participación Ciudadana (CCPC) del INE cuentan, para cada elección federal de 2009 a 2024,",
  "cuántas personas de la lista nominal votaron, cuántas no votaron y cuántas quedaron sin especificar,",
  "por entidad, sexo, grupo de edad y tipo de sección.",
  "La participación oficial se calcula como quienes votaron entre los registros clasificados (votaron más no votaron);",
  "la participación nominal divide a quienes votaron entre toda la lista nominal.",
  "Son datos agregados: no describen a personas concretas ni su voto por partido.",
].join(" ");

export function createRulesUiPlanner(
  interpreter: CivicQueryInterpreter,
  mode: UiPlannerMode = "rules",
): UiPlanner {
  return {
    mode,
    createSession: (input) => new RulesPlannerSession(interpreter, input),
    composeUi: async (input) => composeUi(input),
  };
}

class RulesPlannerSession implements PlannerSession {
  private plan: CivicPlan | undefined;
  private results: AgentToolResult[] = [];

  constructor(
    private readonly interpreter: CivicQueryInterpreter,
    private readonly input: PlannerSessionInput,
  ) {}

  async next(
    toolResults: AgentToolResult[] = [],
    signal?: AbortSignal,
    feedback?: string,
  ): Promise<PlannerResult> {
    if (!this.plan) {
      this.plan = await this.interpreter.interpret(this.input.query, signal);
      if (this.plan.clarification) return { kind: "answer", text: this.plan.clarification };
      if (this.plan.analysis === "methodology") return { kind: "answer", text: METHODOLOGY_ANSWER };
      const available = new Set(this.input.tools.map((tool) => tool.name));
      const toolCalls = planToolCalls(this.plan).filter((call) => available.has(call.name));
      if (toolCalls.length === 0) throw new PlannerProviderError("No hay herramientas disponibles para esta consulta");
      return { kind: "tools", toolCalls };
    }
    if (toolResults.length > 0) this.results = toolResults;
    return { kind: "answer", text: writeAnswer(this.plan, this.results, Boolean(feedback)) };
  }
}

function writeAnswer(plan: CivicPlan, results: readonly AgentToolResult[], conservative: boolean): string {
  const result = results[0];
  if (!result) throw new PlannerProviderError("La consulta no devolvió datos");
  if (results.length === 2 && results.every((item) => item.call.name === BREAKDOWN_TOOL)) {
    return describeAgeBySex(results.map((item) => item.output as GetParticipationBreakdownOutput));
  }
  if (result.call.name === COMPARE_TOOL) return describeComparison(result.output as CompareElectionsOutput, plan, conservative);
  if (result.call.name === BREAKDOWN_TOOL) return describeBreakdown(result.output as GetParticipationBreakdownOutput, plan);
  if (result.call.name === SUPPORTING_TOOL) return describeRecords(result.output as GetSupportingRecordsOutput);
  if (result.call.name === SUMMARY_TOOL) return describeSummary(result.output as GetParticipationSummaryOutput, plan, conservative);
  throw new PlannerProviderError("Herramienta sin redacción determinista");
}

function describeSummary(output: GetParticipationSummaryOutput, plan: CivicPlan, conservative: boolean): string {
  if (output.status === "no_data" || !output.totals) return noDataAnswer(output.scope, output.year);
  const totals = output.totals;
  const place = `${capitalize(where(output.scope))}, en ${output.year}`;
  if (plan.indicator === "abstention" && !conservative) {
    return `${place}, la abstención fue de ${pct(totals.abstentionPct)}: ${count(totals.didNotVote)} de ${count(totals.classified)} `
      + `registros clasificados no votaron. La participación oficial fue de ${pct(totals.participationPct)}.`;
  }
  if (plan.indicator === "nominal-list" && !conservative) {
    return `${place}, la lista nominal fue de ${count(totals.nominalList)}; de ellas, ${count(totals.voted)} votaron, `
      + `una participación nominal de ${pct(totals.nominalParticipationPct)}.`;
  }
  const nominal = conservative
    ? ""
    : ` Sobre toda la lista nominal (${count(totals.nominalList)}), la participación nominal fue de ${pct(totals.nominalParticipationPct)}.`;
  return `${place}, la participación oficial fue de ${pct(totals.participationPct)}: ${count(totals.voted)} de `
    + `${count(totals.classified)} registros clasificados votaron.${nominal}`;
}

function describeComparison(output: CompareElectionsOutput, plan: CivicPlan, conservative: boolean): string {
  const withData = output.elections.filter((election) => election.hasData && election.participationPct !== null);
  if (output.status === "no_data" || withData.length === 0) {
    return `No hay datos de participación ${where(output.scope)} en los años ${output.years.join(", ")} con esos filtros.`;
  }
  const missing = output.elections.filter((election) => !election.hasData).map((election) => election.year);
  const first = withData[0]!;
  const last = withData.at(-1)!;
  const field = plan.indicator === "abstention" ? "abstentionPct" : "participationPct";
  const label = plan.indicator === "abstention" ? "la abstención" : "la participación oficial";
  const series = withData.map((election) => `${election.year}: ${pct(election[field])}`).join("; ");
  const change = output.changes.find((candidate) => candidate.year === last.year && candidate.baselineYear === first.year);
  const points = plan.indicator === "abstention" ? change?.abstentionPoints : change?.participationPoints;
  const movement = points === null || points === undefined || first === last
    ? ""
    : ` Entre ${first.year} y ${last.year} ${points >= 0 ? "subió" : "bajó"} ${num(Math.abs(points))} puntos porcentuales.`;
  const base = conservative
    ? ""
    : ` En ${last.year} votaron ${count(last.voted ?? 0)} de ${count(last.classified ?? 0)} registros clasificados.`;
  const gaps = missing.length > 0 ? ` No hay datos para ${missing.join(", ")}.` : "";
  return `${capitalize(where(output.scope))}, ${label} por elección fue: ${series}.${movement}${base}${gaps}`;
}

function describeBreakdown(output: GetParticipationBreakdownOutput, plan: CivicPlan): string {
  const groups = output.groups.filter((group) => group.participationPct !== null);
  if (output.status === "no_data" || groups.length === 0) return noDataAnswer(output.scope, output.year);
  const field = plan.indicator === "abstention" ? "abstentionPct" : "participationPct";
  const label = plan.indicator === "abstention" ? "La abstención" : "La participación oficial";
  const sorted = [...groups].sort((left, right) => (right[field] ?? 0) - (left[field] ?? 0));
  const listed = sorted.slice(0, 6)
    .map((group) => `${group.group}: ${pct(group[field])} (${count(group.voted)} de ${count(group.classified)})`)
    .join("; ");
  const more = sorted.length > 6 ? ` y ${sorted.length - 6} grupos más en la tabla` : "";
  return `${label} ${where(output.scope)} en ${output.year}, por ${dimensionLabel(output.dimension)}: ${listed}${more}.`;
}

function describeRecords(output: GetSupportingRecordsOutput): string {
  if (output.status === "no_data" || output.records.length === 0) return noDataAnswer(output.scope, output.year);
  const shown = output.truncated
    ? `Se muestran ${count(output.records.length)} de ${count(output.totalRecords)} registros`
    : `Hay ${count(output.totalRecords)} registros`;
  return `${shown} de los conteos censales de participación ${where(output.scope)} en ${output.year}, `
    + "cada uno con su lista nominal, votaron, no votaron y su archivo de origen.";
}

function describeAgeBySex(outputs: readonly GetParticipationBreakdownOutput[]): string {
  const [men, women] = outputs;
  if (!men || !women || men.status === "no_data" || women.status === "no_data") {
    return noDataAnswer(men?.scope ?? "esos filtros", men?.year ?? 2024);
  }
  const peak = (output: GetParticipationBreakdownOutput) => [...output.groups]
    .filter((group) => group.participationPct !== null)
    .sort((left, right) => (right.participationPct ?? 0) - (left.participationPct ?? 0))[0];
  const topMen = peak(men);
  const topWomen = peak(women);
  if (!topMen || !topWomen) return noDataAnswer(men.scope, men.year);
  return `Participación oficial por edad y sexo ${where(men.scope)} en ${men.year}: entre los hombres, el grupo con mayor `
    + `participación fue ${topMen.group} con ${pct(topMen.participationPct)} (${count(topMen.voted)} de ${count(topMen.classified)}); `
    + `entre las mujeres, ${topWomen.group} con ${pct(topWomen.participationPct)} (${count(topWomen.voted)} de ${count(topWomen.classified)}). `
    + "La tabla muestra todos los grupos de edad.";
}

function noDataAnswer(scope: string, year: number): string {
  return `No hay datos de participación ${where(scope)} en ${year} con esos filtros. `
    + "La falta de registros no indica la participación real; prueba con otro año o entidad "
    + `(hay conteos para ${CCPC_YEARS.join(", ")}).`;
}

function where(scope: string): string {
  return scope === "Nacional" ? "a nivel nacional" : `en ${scope}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dimensionLabel(dimension: GetParticipationBreakdownOutput["dimension"]): string {
  if (dimension === "grupo_edad") return "grupo de edad";
  if (dimension === "tipo_seccion") return "tipo de sección";
  return dimension;
}

function composeUi(input: UiGenerationInput): UiDocument {
  const composed = composeCivicUi(input);
  if (composed) return composed;
  const document = createCivicUiFallback(input.dataSources) ?? textDocument(input.answer);
  try {
    return parseUiDocument(document, input.dataSources);
  } catch {
    throw new UiCompositionError("No fue posible componer una interfaz válida con los datos");
  }
}

function textDocument(answer: string): UiDocument {
  return {
    version: "1.0",
    root: {
      id: "civic-answer",
      type: "card",
      title: "Participación ciudadana",
      children: [{ id: "civic-answer-text", type: "text", variant: "body", text: answer.slice(0, 2_000) }],
    },
  };
}

function pct(value: number | null): string {
  return value === null ? "sin dato" : `${num(value)} %`;
}

function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}
