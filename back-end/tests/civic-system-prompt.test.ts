import assert from "node:assert/strict";
import test from "node:test";
import { createCivicSystemPrompt } from "../src/agent/prompts/civic-system-prompt.js";
import { createUiRecoveryPlan } from "../src/ui/generation/ui-recovery-planner.js";
import { createUiSystemPrompt } from "../src/ui/generation/ui-prompt.js";

test("el prompt cívico incluye la fecha y las reglas de neutralidad", () => {
  const prompt = createCivicSystemPrompt("2026-10-08");
  assert.match(prompt, /La fecha actual es 2026-10-08/u);
  assert.match(prompt, /datos electorales/u);
  assert.match(prompt, /neutralidad política/u);
  assert.match(prompt, /nacional y estatal/u);
});

test("el prompt cívico no contiene instrucciones financieras", () => {
  const prompt = createCivicSystemPrompt("2026-10-08");
  assert.doesNotMatch(
    prompt,
    /banc|financ|saldo|pago|transacci|transferencia|préstamo|ahorro|beneficiari|get_accounts|compare_periods|confirm_payment/iu,
  );
});

const FINANCIAL_TERMS = /banc|financ|saldo|pago|transacci|transferencia|préstamo|ahorro|beneficiari|get_accounts|compare_periods|confirm_payment/iu;

test("el prompt de la interfaz no contiene instrucciones financieras", () => {
  assert.doesNotMatch(createUiSystemPrompt(), FINANCIAL_TERMS);
});

test("el prompt de la interfaz exige evidencia, fuente y puntos porcentuales", () => {
  const prompt = createUiSystemPrompt();
  assert.match(prompt, /evidencia verificable/u);
  assert.match(prompt, /isSampleData/u);
  assert.match(prompt, /puntos porcentuales/u);
  assert.match(prompt, /numerador y su denominador/u);
});

test("el plan de recuperación de la interfaz no contiene instrucciones financieras", () => {
  const plan = createUiRecoveryPlan({
    issues: [{ code: "table_required", message: "Falta la tabla" }] as never,
    dataSources: [],
    attempt: 1,
  });
  assert.doesNotMatch(plan, FINANCIAL_TERMS);
});
