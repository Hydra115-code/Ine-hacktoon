import { uiSpecificationSchema, type DataRegistryValue, type UISpecification } from "@ine/contracts";
import { ineParticipationSpecification } from "../../../features/generative-ui/fixtures/ine-participation-fixture.ts";

export type ParticipationHarnessView = "complete" | "without-chart" | "table-only";
export type SyntheticEntityId = "national-scenario" | "entity-alpha" | "entity-beta";

interface SyntheticPeriod {
  nominalList: number;
  participation: number;
  period: "2009" | "2024";
  votes: number;
}

interface SyntheticEntity {
  id: SyntheticEntityId;
  label: string;
  periods: readonly [SyntheticPeriod, SyntheticPeriod];
}

export const syntheticParticipationEntities: readonly SyntheticEntity[] = [
  {
    id: "national-scenario",
    label: "Escenario nacional",
    periods: [
      { period: "2009", votes: 45, nominalList: 100, participation: 45 },
      { period: "2024", votes: 61, nominalList: 100, participation: 61 },
    ],
  },
  {
    id: "entity-alpha",
    label: "Entidad Alfa",
    periods: [
      { period: "2009", votes: 52, nominalList: 100, participation: 52 },
      { period: "2024", votes: 67, nominalList: 100, participation: 67 },
    ],
  },
  {
    id: "entity-beta",
    label: "Entidad Beta",
    periods: [
      { period: "2009", votes: 48, nominalList: 100, participation: 48 },
      { period: "2024", votes: 57, nominalList: 100, participation: 57 },
    ],
  },
] as const;

export function buildSyntheticParticipationData(entityId: SyntheticEntityId): DataRegistryValue {
  const entity = syntheticParticipationEntities.find((candidate) => candidate.id === entityId)
    ?? syntheticParticipationEntities[0];
  const [first, last] = entity.periods;

  return {
    entity: { id: entity.id, label: entity.label },
    summary: {
      firstPeriodLabel: "Participación 2009 (%)",
      lastPeriodLabel: "Participación 2024 (%)",
      firstParticipation: first.participation,
      lastParticipation: last.participation,
      differencePoints: Number((last.participation - first.participation).toFixed(1)),
    },
    periods: entity.periods.map((period) => ({ ...period })),
  };
}

export function buildParticipationHarnessSpecification(view: ParticipationHarnessView): UISpecification {
  if (ineParticipationSpecification.root.type !== "section") {
    throw new Error("El fixture INE debe tener una sección como raíz");
  }

  const entityFilter = {
    type: "select" as const,
    id: "participation-entity-filter",
    label: "Entidad",
    event: "participation.entity.changed",
    options: syntheticParticipationEntities.map(({ id, label }) => ({ value: id, label })),
    initialValue: "national-scenario",
  };
  const baseChildren = [
    ...ineParticipationSpecification.root.children.slice(0, 2),
    entityFilter,
    ...ineParticipationSpecification.root.children.slice(2),
  ];
  const children = view === "table-only"
    ? baseChildren.filter((node) => node.type === "table")
    : view === "without-chart"
      ? baseChildren.filter((node) => node.type !== "visualization")
      : baseChildren;

  return uiSpecificationSchema.parse({
    ...ineParticipationSpecification,
    root: { ...ineParticipationSpecification.root, children },
  });
}
