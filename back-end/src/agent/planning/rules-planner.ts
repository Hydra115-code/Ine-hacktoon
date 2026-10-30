import { CCPC_AGE_GROUPS, CCPC_YEARS } from "../../application/ports/civic-data.js";
import { ENTITIES } from "../../domain/civic-entities.js";
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
import { readLatestRequest, type CivicQueryInterpreter } from "./civic-query-interpreter.js";
import { type CivicAnswerWriter } from "./gemini-answer-writer.js";
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
  answerWriter?: CivicAnswerWriter,
): UiPlanner {
  return {
    mode,
    createSession: (input) => new RulesPlannerSession(interpreter, input, answerWriter),
    composeUi: async (input) => composeUi(input),
  };
}

class RulesPlannerSession implements PlannerSession {
  private plan: CivicPlan | undefined;
  private results: AgentToolResult[] = [];

  constructor(
    private readonly interpreter: CivicQueryInterpreter,
    private readonly input: PlannerSessionInput,
    private readonly answerWriter?: CivicAnswerWriter,
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
    const verified = writeAnswer(this.plan, this.results, Boolean(feedback));
    if (!this.answerWriter || feedback) return { kind: "answer", text: verified };
    const question = readLatestRequest(this.input.query).text;
    return { kind: "answer", text: await this.answerWriter.rewrite(question, verified, signal) };
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
  const place = `${capitalize(whereFor(output))}, en ${output.year}`;
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
    return `No hay datos de participación ${whereFor(output)} en los años ${output.years.join(", ")} con esos filtros.`;
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
  if (plan.focus === "maximum-change" && output.changes.length > 0) {
    const changeField = plan.indicator === "abstention" ? "abstentionPoints" : "participationPoints";
    const extreme = [...output.changes]
      .filter((candidate) => candidate[changeField] !== null)
      .sort((left, right) => Math.abs(right[changeField] ?? 0) - Math.abs(left[changeField] ?? 0))[0];
    const value = extreme?.[changeField];
    if (extreme && value !== null && value !== undefined) {
      return `${capitalize(whereFor(output))}, el mayor cambio de ${label} ocurrió entre ${extreme.baselineYear} y ${extreme.year}: `
        + `${value >= 0 ? "subió" : "bajó"} ${num(Math.abs(value))} puntos porcentuales. Serie completa: ${series}.${base}${gaps}`;
    }
  }
  return `${capitalize(whereFor(output))}, ${label} por elección fue: ${series}.${movement}${base}${gaps}`;
}

function describeBreakdown(output: GetParticipationBreakdownOutput, plan: CivicPlan): string {
  const groups = output.groups.filter((group) => group.participationPct !== null);
  if (output.status === "no_data" || groups.length === 0) return noDataAnswer(output.scope, output.year);
  const field = plan.indicator === "abstention" ? "abstentionPct" : "participationPct";
  const label = plan.indicator === "abstention" ? "La abstención" : "La participación oficial";
  const sorted = [...groups].sort((left, right) => (right[field] ?? 0) - (left[field] ?? 0));
  if (plan.focus === "coverage" && output.dimension === "entidad") {
    const observed = new Set(groups.map((group) => group.group));
    const missing = ENTITIES.filter((entity) => !observed.has(entity.name)).map((entity) => entity.name);
    return missing.length === 0
      ? `Las 32 entidades tienen observaciones disponibles para ${output.year} con estos filtros.`
      : `En ${output.year} faltan observaciones para ${missing.join(", ")}. La tabla conserva las entidades con datos disponibles.`;
  }
  const listed = sorted.slice(0, 6)
    .map((group) => `${group.group}: ${pct(group[field])} (${count(group.voted)} de ${count(group.classified)})`)
    .join("; ");
  const more = sorted.length > 6 ? ` y ${sorted.length - 6} grupos más en la tabla` : "";
  return `${label} ${whereFor(output, output.dimension)} en ${output.year}, por ${dimensionLabel(output.dimension)}: ${listed}${more}.`;
}

function describeRecords(output: GetSupportingRecordsOutput): string {
  if (output.status === "no_data" || output.records.length === 0) return noDataAnswer(output.scope, output.year);
  const shown = output.truncated
    ? `Se muestran ${count(output.records.length)} de ${count(output.totalRecords)} registros`
    : `Hay ${count(output.totalRecords)} registros`;
  return `${shown} de los conteos censales de participación ${whereFor(output)} en ${output.year}, `
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
  return `Participación oficial por edad y sexo ${whereFor(men, "grupo_edad", "sexo")} en ${men.year}: entre los hombres, el grupo con mayor `
    + `participación fue ${topMen.group} con ${pct(topMen.participationPct)} (${count(topMen.voted)} de ${count(topMen.classified)}); `
    + `entre las mujeres, ${topWomen.group} con ${pct(topWomen.participationPct)} (${count(topWomen.voted)} de ${count(topWomen.classified)}). `
    + "La tabla muestra todos los grupos de edad.";
}

function noDataAnswer(scope: string, year: number): string {
  return `No hay datos de participación ${where(scope)} en ${year} con esos filtros. `
    + "La falta de registros no indica la participación real; prueba con otro año o entidad "
    + `(hay conteos para ${CCPC_YEARS.join(", ")}).`;
}

type AppliedFilters = GetParticipationSummaryOutput["filters"];
type Dimension = GetParticipationBreakdownOutput["dimension"];

const SEX_LABELS: Record<string, string> = { hombre: "hombres", mujer: "mujeres", no_binario: "personas no binarias" };
const SECTION_LABELS: Record<string, string> = { urbana: "urbanas", mixta: "mixtas", rural: "rurales" };

function whereFor(output: { scope: string; filters: AppliedFilters }, ...excluded: Dimension[]): string {
  const group = audience(output.filters, excluded);
  return group ? `entre ${group} ${where(output.scope)}` : where(output.scope);
}

function audience(filters: AppliedFilters, excluded: readonly Dimension[]): string {
  const sexes = excluded.includes("sexo") ? [] : filters.sexes ?? [];
  const ages = excluded.includes("grupo_edad") ? [] : filters.ageGroups ?? [];
  const sections = excluded.includes("tipo_seccion") ? [] : filters.sectionTypes ?? [];
  if (sexes.length === 0 && ages.length === 0 && sections.length === 0) return "";
  const who = sexes.length > 0 ? joinWords(sexes.map((sex) => SEX_LABELS[sex] ?? sex)) : "personas";
  const age = ages.length > 0 ? ` ${ageLabel(ages)}` : "";
  const section = sections.length > 0 ? ` de secciones ${joinWords(sections.map((type) => SECTION_LABELS[type] ?? type))}` : "";
  return `${who}${age}${section}`;
}

function ageLabel(groups: readonly string[]): string {
  const ordered = CCPC_AGE_GROUPS.filter((group) => groups.includes(group));
  const first = ordered[0]!;
  const last = ordered.at(-1)!;
  const contiguous = CCPC_AGE_GROUPS.indexOf(last) - CCPC_AGE_GROUPS.indexOf(first) === ordered.length - 1;
  if (!contiguous) return `de los grupos de edad ${joinWords(ordered)}`;
  const from = first.split("-")[0]!.replace("+", "");
  if (last === "100+") return `de ${from} años o más`;
  return `de ${from} a ${last.split("-")[1]} años`;
}

function joinWords(words: readonly string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} y ${words.at(-1)}`;
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
