import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type CivicPlan } from "../../src/agent/planning/civic-plan.js";
import { rulesQueryInterpreter, type CivicQueryInterpreter } from "../../src/agent/planning/civic-query-interpreter.js";
import { LocalModelQueryInterpreter, type LocalModelOutcome } from "../../src/agent/planning/local-model-interpreter.js";
import { classifyCivicQuery } from "../../src/agent/security/civic-scope-policy.js";
import { EVALUATION_CASES, type EvaluationCase } from "./cases.js";

interface CaseResult {
  query: string;
  intent: boolean;
  filters: boolean;
  invented: boolean;
  latencyMs: number;
  outcome: LocalModelOutcome | "rules";
  plan: string;
  errors: string[];
}

const url = process.env.LOCAL_MODEL_URL || "http://127.0.0.1:11434";
const model = process.env.LOCAL_MODEL_NAME || "";
const timeoutMs = Number(process.env.LOCAL_MODEL_TIMEOUT_MS || 8_000);
const withoutInternet = process.argv.includes("--sin-internet");
const reportPath = path.resolve("docs/evaluacion-modelo-local.md");

const available = model ? await isModelAvailable() : false;
let lastOutcome: LocalModelOutcome = "fallback";
const local = new LocalModelQueryInterpreter(
  { url, model, timeoutMs },
  rulesQueryInterpreter,
  fetch,
  (outcome) => { lastOutcome = outcome; },
);

if (available) await local.interpret("participación en Jalisco en 2024");
const rules = await evaluate(rulesQueryInterpreter, false);
const hybrid = available ? await evaluate(local, true) : [];
const memory = available ? await readModelMemory() : undefined;

const report = buildReport(rules, hybrid, memory);
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, report, "utf8");
process.stdout.write(`${summaryLine("Reglas", rules)}\n`);
if (available) {
  process.stdout.write(`${summaryLine("Modelo local (con respaldo)", hybrid)}\n`);
  process.stdout.write(`${summaryLine("Modelo local (sólo modelo)", modelOnly(hybrid))}\n`);
} else {
  process.stdout.write(`Modelo local no disponible en ${url} (${model || "sin LOCAL_MODEL_NAME"}).\n`);
}
process.stdout.write(`Reporte: ${reportPath}\n`);

async function evaluate(interpreter: CivicQueryInterpreter, isLocal: boolean): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const item of EVALUATION_CASES) {
    const blocked = !classifyCivicQuery(item.query).allowed;
    const started = performance.now();
    let plan: CivicPlan | undefined;
    try {
      plan = await interpreter.interpret(item.query);
    } catch {
      plan = undefined;
    }
    const latencyMs = performance.now() - started;
    results.push({
      query: item.query,
      ...score(item, plan, blocked),
      latencyMs,
      outcome: isLocal ? lastOutcome : "rules",
      plan: plan ? describe(plan) : "error",
      errors: classifyErrors(item, plan),
    });
  }
  return results;
}

function score(item: EvaluationCase, plan: CivicPlan | undefined, blocked: boolean) {
  if (!plan) return { intent: false, filters: false, invented: false };
  const expected = item.expected;
  if (expected.clarification) {
    const handled = Boolean(plan.clarification) || (item.outOfDomain === true && blocked);
    return { intent: handled, filters: handled, invented: false };
  }
  const intent = !plan.clarification && plan.analysis === expected.analysis;
  const keys = ["years", "entityCodes", "sexes", "ageGroups", "sectionTypes"] as const;
  const sameLists = keys.every((key) => sameList(plan[key], expected[key] ?? []));
  const sameBreakdown = expected.analysis !== "breakdown" || plan.breakdown === expected.breakdown;
  const sameIndicator = plan.indicator === (expected.indicator ?? "participation");
  const filters = expected.analysis === "methodology"
    ? intent && plan.entityCodes.length === 0 && plan.years.length === 0
    : intent && sameLists && sameBreakdown && sameIndicator;
  const invented = keys.some((key) => (plan[key] as readonly (string | number)[])
    .some((value) => !(expected[key] ?? [] as Array<string | number>).map(String).includes(String(value))));
  return { intent, filters, invented };
}

function classifyErrors(item: EvaluationCase, plan: CivicPlan | undefined): string[] {
  const expected = item.expected;
  if (!plan) return ["sin plan"];
  if (expected.clarification) return plan.clarification || item.outOfDomain ? [] : ["no pidió aclaración"];
  const errors: string[] = [];
  if (plan.clarification) errors.push("pidió aclaración sin necesidad");
  else if (plan.analysis !== expected.analysis) errors.push("tipo de análisis equivocado");
  if (expected.analysis !== "methodology") {
    if (!sameList(plan.entityCodes, expected.entityCodes ?? [])) errors.push("entidad equivocada");
    if (!sameList(plan.years, expected.years ?? [])) errors.push("años equivocados");
    if (!sameList(plan.sexes, expected.sexes ?? [])) errors.push("filtro de sexo equivocado");
    if (!sameList(plan.ageGroups, expected.ageGroups ?? [])) errors.push("grupos de edad equivocados");
    if (!sameList(plan.sectionTypes, expected.sectionTypes ?? [])) errors.push("tipo de sección equivocado");
    if (plan.indicator !== (expected.indicator ?? "participation")) errors.push("indicador equivocado");
  }
  return errors;
}

function errorSummary(results: readonly CaseResult[]): string {
  const counts = new Map<string, number>();
  for (const result of results) for (const error of result.errors) counts.set(error, (counts.get(error) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1]).map(([error, count]) => `${error} (${count})`).join(", ") || "ninguno";
}

function verdict(rulesResults: CaseResult[], hybridResults: CaseResult[]): string[] {
  if (hybridResults.length === 0) return ["El modelo local no estaba disponible; no hay comparación."];
  const rule = stats(rulesResults);
  const hybrid = stats(hybridResults);
  const improves = hybrid.filters > rule.filters && hybrid.invented <= rule.invented && hybrid.outOfDomain >= rule.outOfDomain;
  return [
    improves
      ? `Sí mejora: con el modelo local hay ${hybrid.filters}/${EVALUATION_CASES.length} filtros correctos contra ${rule.filters} de las reglas, sin inventar más filtros.`
        + " Se puede usar `UI_PLANNER_MODE=local-model`."
      : `No mejora: con el modelo local hay ${hybrid.filters}/${EVALUATION_CASES.length} filtros correctos contra ${rule.filters} de las reglas,`
        + ` inventa ${hybrid.invented} filtros y tarda ${hybrid.p95.toFixed(0)} ms en el percentil 95 contra ${rule.p95.toFixed(0)} ms.`
        + " Se mantiene `UI_PLANNER_MODE=rules` por defecto; `local-model` queda como opción con respaldo automático a reglas.",
    "",
    `- Errores de las reglas: ${errorSummary(rulesResults)}.`,
    `- Errores del modelo local (con respaldo): ${errorSummary(hybridResults)}.`,
  ];
}

function sameList(actual: readonly (string | number)[], expected: readonly (string | number)[]): boolean {
  const normalize = (values: readonly (string | number)[]) => values.map(String).sort().join(",");
  return normalize(actual) === normalize(expected);
}

function describe(plan: CivicPlan): string {
  if (plan.clarification) return "aclaración";
  const parts: string[] = [plan.analysis];
  if (plan.breakdown) parts.push(`por ${plan.breakdown}`);
  if (plan.indicator !== "participation") parts.push(plan.indicator);
  if (plan.years.length > 0) parts.push(plan.years.join("/"));
  if (plan.entityCodes.length > 0) parts.push(`entidades ${plan.entityCodes.join(",")}`);
  if (plan.sexes.length > 0) parts.push(plan.sexes.join(","));
  if (plan.ageGroups.length > 0) parts.push(`edad ${plan.ageGroups[0]}…${plan.ageGroups.at(-1)}`);
  if (plan.sectionTypes.length > 0) parts.push(plan.sectionTypes.join(","));
  return parts.join(" · ");
}

function modelOnly(results: readonly CaseResult[]): CaseResult[] {
  return results.map((result) => (result.outcome === "fallback"
    ? { ...result, intent: false, filters: false }
    : result));
}

function stats(results: readonly CaseResult[]) {
  const latencies = results.map((result) => result.latencyMs).sort((left, right) => left - right);
  const percentile = (fraction: number) => latencies[Math.min(latencies.length - 1, Math.floor(fraction * latencies.length))] ?? 0;
  return {
    intent: results.filter((result) => result.intent).length,
    filters: results.filter((result) => result.filters).length,
    invented: results.filter((result) => result.invented).length,
    outOfDomain: results.filter((result, index) => EVALUATION_CASES[index]?.outOfDomain && result.intent).length,
    fallbacks: results.filter((result) => result.outcome === "fallback").length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: latencies.at(-1) ?? 0,
  };
}

function summaryLine(label: string, results: readonly CaseResult[]): string {
  const value = stats(results);
  return `${label}: intención ${value.intent}/${results.length}, filtros ${value.filters}/${results.length}, `
    + `inventó ${value.invented}, fuera de dominio ${value.outOfDomain}/6, p95 ${value.p95.toFixed(0)} ms, respaldos ${value.fallbacks}`;
}

function buildReport(rulesResults: CaseResult[], hybridResults: CaseResult[], modelMemory?: { sizeMb: number; vramMb: number }): string {
  const total = EVALUATION_CASES.length;
  const rows: Array<[string, CaseResult[]]> = [["Reglas", rulesResults]];
  if (hybridResults.length > 0) {
    rows.push(["Modelo local con respaldo a reglas", hybridResults], ["Sólo el modelo local", modelOnly(hybridResults)]);
  }
  const table = rows.map(([label, results]) => {
    const value = stats(results);
    return `| ${label} | ${value.intent}/${total} | ${value.filters}/${total} | ${value.invented} | ${value.outOfDomain}/6 | `
      + `${value.p50.toFixed(0)} / ${value.p95.toFixed(0)} / ${value.max.toFixed(0)} ms | ${value.fallbacks} |`;
  });
  const lines = [
    "# Evaluación del modelo local para el planificador",
    "",
    `- Fecha: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    `- Modelo: ${model || "no configurado"} en ${url} (${available ? "disponible" : "no disponible"})`,
    `- Tiempo límite por consulta: ${timeoutMs} ms`,
    `- Conexión a internet durante la prueba: ${withoutInternet ? "desconectada" : "no se desconectó"}`,
    `- Consultas: ${total} (${total - 6} del dominio electoral y 6 fuera de dominio)`,
    modelMemory ? `- Memoria del modelo cargado: ${modelMemory.sizeMb} MB (VRAM ${modelMemory.vramMb} MB)` : "- Memoria del modelo: sin medir",
    `- Memoria del proceso de evaluación: ${Math.round(process.memoryUsage().rss / 1_048_576)} MB`,
    "",
    "| Modo | Intención correcta | Filtros correctos | Inventó filtros | Fuera de dominio | Latencia p50 / p95 / máx | Respaldos |",
    "|---|---|---|---|---|---|---|",
    ...table,
    "",
    "## Conclusión",
    "",
    ...verdict(rulesResults, hybridResults),
    "",
    "## Casos con diferencias",
    "",
    "| Consulta | Reglas | Modelo local |",
    "|---|---|---|",
    ...EVALUATION_CASES.flatMap((item, index) => {
      const rule = rulesResults[index]!;
      const hybrid = hybridResults[index];
      if (rule.filters && (!hybrid || hybrid.filters)) return [];
      const mark = (result: CaseResult | undefined) => (result ? `${result.filters ? "✅" : "❌"} ${result.plan}${result.outcome === "fallback" ? " (respaldo)" : ""}` : "—");
      return [`| ${item.query} | ${mark(rule)} | ${mark(hybrid)} |`];
    }),
    "",
  ];
  return lines.join("\n");
}

async function isModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/tags", url), { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return false;
    const body = await response.json() as { models?: Array<{ name?: string; model?: string }> };
    return (body.models ?? []).some((item) => item.name === model || item.model === model || item.name === `${model}:latest`);
  } catch {
    return false;
  }
}

async function readModelMemory(): Promise<{ sizeMb: number; vramMb: number } | undefined> {
  try {
    const response = await fetch(new URL("/api/ps", url), { signal: AbortSignal.timeout(3_000) });
    const body = await response.json() as { models?: Array<{ name?: string; size?: number; size_vram?: number }> };
    const loaded = (body.models ?? []).find((item) => item.name?.startsWith(model));
    return loaded ? { sizeMb: Math.round((loaded.size ?? 0) / 1_048_576), vramMb: Math.round((loaded.size_vram ?? 0) / 1_048_576) } : undefined;
  } catch {
    return undefined;
  }
}
