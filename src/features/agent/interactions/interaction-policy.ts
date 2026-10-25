export type InteractionKind = "analysis" | "simulation" | "visual" | "authoritative_action";

export interface InteractionPolicyDecision {
  kind: InteractionKind;
  delivery: "agent" | "local" | "blocked";
}

const VISUAL_EVENT = /^(?:ui\.(?:accordion|tab)\.|view\.|table\.(?:filter|page|sort)\.)/u;
const LOCAL_EXPLORATION_EVENT = /^(?:methodology\.opened|period\.changed|timeline\.period_selected|map\.entity_selected|territory\.selected)$/u;
const SIMULATION_EVENT = /^(?:scenario|simulation|projection)\./u;
const MUTATION_NAMESPACE = /^(?:action|case|credential|export|payment|record|report|submission|transaction|transfer)\./u;
const AUTHORITATIVE_ACTION = /(?:^|\.)(?:approve|authorize|cancel|confirm|delete|execute|pay|publish|retry|send|submit)(?:_|\.|$)/u;
const SAFE_DRAFT_EVENT = /^(?:action|case|payment|report|submission)\.(?:draft|review)\.(?:cancel|edit)(?:_|\.|$)/u;

/**
 * Frontend safety policy. The event contract remains unchanged: this only decides
 * whether a valid intent may leave the browser.
 */
export function classifyInteractionEvent(name: string): InteractionPolicyDecision {
  if (name === "form.value.changed") return { kind: "visual", delivery: "local" };
  if (LOCAL_EXPLORATION_EVENT.test(name)) return { kind: "visual", delivery: "local" };
  if (VISUAL_EVENT.test(name)) return { kind: "visual", delivery: "local" };
  if (SAFE_DRAFT_EVENT.test(name)) return { kind: "analysis", delivery: "agent" };
  if (MUTATION_NAMESPACE.test(name) && AUTHORITATIVE_ACTION.test(name)) {
    return { kind: "authoritative_action", delivery: "blocked" };
  }
  if (SIMULATION_EVENT.test(name)) return { kind: "simulation", delivery: "agent" };
  return { kind: "analysis", delivery: "agent" };
}
