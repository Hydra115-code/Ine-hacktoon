import assert from "node:assert/strict";
import test from "node:test";
import { emptyFinancialConstraints, updateFinancialConstraints } from "../src/domain/financial-constraints.js";
import { createFollowUpQuery, type AgentSessionSnapshot } from "../src/integration/agent-session-store.js";

test("conserva y versiona las restricciones financieras relevantes", () => {
  const first = updateFinancialConstraints(
    emptyFinancialConstraints(),
    "Quiero ahorrar 50k en 8 meses, puedo ahorrar 4k al mes y no puedo reducir la renta.",
  );

  assert.equal(first.changed, true);
  assert.deepEqual(first.constraints, {
    revision: 1,
    savingsGoal: { amount: "50000.00", currency: "MXN" },
    horizonMonths: 8,
    monthlyContribution: { amount: "4000.00", currency: "MXN" },
    protectedExpenseCategories: ["housing"],
  });

  const unchanged = updateFinancialConstraints(first.constraints, "Muéstrame el resultado otra vez");
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.constraints.revision, 1);

  const changed = updateFinancialConstraints(first.constraints, "Ahora sí puedo reducir la renta");
  assert.equal(changed.changed, true);
  assert.equal(changed.constraints.revision, 2);
  assert.deepEqual(changed.constraints.protectedExpenseCategories, []);
});

test("invalida recomendaciones anteriores cuando cambia una restricción", () => {
  const state: AgentSessionSnapshot = {
    sessionId: "session-1", interfaceRevision: 1, dataRevision: 1, dataKeys: [],
    turns: [{ user: "Hazme un plan", assistant: "RECOMMENDED: ahorra 3,000 al mes" }],
    interactionState: {}, financialConstraints: emptyFinancialConstraints(),
  };

  const query = createFollowUpQuery(state, "Puedo ahorrar 4k/mes");

  assert.match(query, /"constraintsChanged":true/u);
  assert.match(query, /RECOMMENDED anterior invalidada/u);
  assert.doesNotMatch(query, /ahorra 3,000 al mes/u);
});

