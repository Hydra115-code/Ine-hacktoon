import assert from "node:assert/strict";
import test from "node:test";
import { createCivicSystemPrompt } from "../src/agent/prompts/civic-system-prompt.js";

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
