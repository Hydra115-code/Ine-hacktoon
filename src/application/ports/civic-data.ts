/**
 * Puerto de datos cívicos: es la "conexión intermedia" entre las tools y la
 * fuente de datos. Hoy lo implementan los datos de ejemplo
 * (`src/fixtures/civic-data.fixture.ts`); cuando el Data Engine esté listo se
 * crea otra implementación con la misma forma y las tools no cambian.
 */

export type ElectionOffice = "presidencia" | "senadurias" | "diputaciones";
export type DemographicDimension = "sexo" | "grupo_edad";

export interface CivicDataSourceInfo {
  name: string;
  url?: string | undefined;
  note?: string | undefined;
}

/** Resultado de un proceso electoral en un nivel territorial (nacional o una entidad). */
export interface ProcessResultRecord {
  recordId: string;
  year: number;
  office: ElectionOffice;
  /** "Nacional" o el nombre de la entidad federativa. */
  entity: string;
  results: Array<{ party: string; votes: number }>;
  nominalList: number;
  source: CivicDataSourceInfo;
  isSampleData: boolean;
}

/** Participación de un grupo de población (por sexo o por grupo de edad). */
export interface DemographicTurnoutRecord {
  recordId: string;
  year: number;
  office: ElectionOffice;
  entity: string;
  dimension: DemographicDimension;
  group: string;
  nominalList: number;
  voters: number;
  source: CivicDataSourceInfo;
  isSampleData: boolean;
}

export interface ProcessQuery {
  year: number;
  office: ElectionOffice;
}

export interface CivicDataSource {
  /** Busca el resultado de un proceso en una entidad o a nivel nacional. */
  findProcessResult(query: ProcessQuery & { entity: string }): Promise<ProcessResultRecord | undefined>;
  /** Todos los resultados disponibles de un proceso (nacional y entidades). */
  listProcessResults(query: ProcessQuery): Promise<ProcessResultRecord[]>;
  /** Participación por grupos de población para un proceso y territorio. */
  listDemographicTurnout(
    query: ProcessQuery & { entity: string; dimension: DemographicDimension },
  ): Promise<DemographicTurnoutRecord[]>;
}
