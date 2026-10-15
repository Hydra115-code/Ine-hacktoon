import { createHash } from 'node:crypto';
import type { ParticipationRecord, ParticipationSource } from '../domain/civic/participation.ts';
import { parseParticipationDataset } from '../schemas/civic/participation.schema.ts';
import { parseParticipationFilters } from '../application/ports/participation-data.ts';
import type { DatasetMetadata, ParticipationDataPort, ParticipationFilters } from '../application/ports/participation-data.ts';

/** Same canonical representation used by the DATA-02 records manifest; no I/O. */
function canonicalJson(input: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, child]) => [key, canonical(child)]));
    }
    return value;
  };
  return JSON.stringify(canonical(input), null, 2) + '\n';
}

/** Parsed models contain only primitives, arrays and ordinary object values. */
function freezeSnapshot<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}

function matchesSource(source: ParticipationSource, filters: ParticipationFilters): boolean {
  return (filters.year === undefined || source.year === filters.year)
    && (filters.entityCodes === undefined || (filters.entityCodes as readonly string[]).includes(source.entityCode));
}

function matchesRecord(record: ParticipationRecord, filters: ParticipationFilters): boolean {
  return (filters.year === undefined || record.year === filters.year)
    && (filters.entityCodes === undefined || (filters.entityCodes as readonly string[]).includes(record.entityCode))
    && (filters.sexes === undefined || filters.sexes.includes(record.sex))
    && (filters.ageGroups === undefined || (filters.ageGroups as readonly string[]).includes(record.ageGroup))
    && (filters.sectionTypes === undefined || filters.sectionTypes.includes(record.sectionType));
}

/**
 * Pure in-memory repository over a defensive, runtime-validated dataset snapshot.
 * The backend must validate acquisition/checksums with DATA-02 before injection;
 * runtime_schema describes this factory's model checks, not a fresh file audit.
 */
export function createParticipationRepository(input: unknown): ParticipationDataPort {
  const dataset = freezeSnapshot(parseParticipationDataset(input));
  const metadata: DatasetMetadata = freezeSnapshot({
    schemaVersion: dataset.schemaVersion,
    kind: dataset.kind,
    years: [...dataset.years],
    recordsSha256: createHash('sha256').update(canonicalJson(dataset.records)).digest('hex'),
    validation: 'runtime_schema',
  });
  return Object.freeze({
    metadata,
    selectRecords(filters: ParticipationFilters): readonly ParticipationRecord[] {
      const parsed = parseParticipationFilters(filters);
      return Object.freeze(dataset.records.filter(record => matchesRecord(record, parsed)));
    },
    selectSources(filters: ParticipationFilters): readonly ParticipationSource[] {
      const parsed = parseParticipationFilters(filters);
      // Age/sex/section filters may legitimately match no row. Retain the
      // documented year/entity source context to explain that absence.
      return Object.freeze(dataset.sources.filter(source => matchesSource(source, parsed)));
    },
  });
}
