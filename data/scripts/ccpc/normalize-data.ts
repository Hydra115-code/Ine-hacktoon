import { readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectArchive } from './inspect-data.ts';
import { key } from './model.ts';
import type { Row } from './model.ts';
import { compareEntityNames } from './quality.ts';
import { validateCatalog } from './validation.ts';
import { CCPC_YEARS, parseSelectedYear } from './years.ts';
import { publishDataset } from './etl-io.ts';
import { AGE_GROUPS, calculateMetrics, CivicParticipationError, compareParticipationRecords, METRIC_DEFINITIONS, participationKey, SEXES, SECTION_TYPES } from '../../src/domain/civic/participation.ts';
import type { Counts, ParticipationDataset, ParticipationRecord, ParticipationSource } from '../../src/domain/civic/participation.ts';
import { parseParticipationDataset } from '../../src/schemas/civic/participation.schema.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function assertFullOutputDirectory(out: string): void {
  const comparable = (path: string) => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  const sampleRoot = comparable(join(ROOT, 'data/ccpc/sample'));
  const target = comparable(out);
  if (target === sampleRoot || target.startsWith(sampleRoot + sep)) {
    throw new CivicParticipationError('SAMPLE_OUTPUT_FORBIDDEN', 'El conjunto completo no puede publicarse dentro del fixture reducido.');
  }
}
const counts = (row: { LN: number; SV: number; NV: number; NS: number }): Counts => ({
  nominalList: row.LN, voted: row.SV, didNotVote: row.NV, unspecified: row.NS,
});

/** Convierte agregados íntegros verificados; nunca promedia porcentajes. */
export function normalizeAggregateRows(rows: readonly Row[], sources: readonly ParticipationSource[], groupSourceRows: ReadonlyMap<string, number>, kind: 'full' | 'sample' = 'full'): ParticipationDataset {
  if (!Array.isArray(rows) || !rows.length || !(groupSourceRows instanceof Map)) {
    throw new CivicParticipationError('INVALID_RAW_MAPPING', 'Se requieren agregados no vacíos y un mapa de filas de origen.');
  }
  const expectedFields = ['entidad_clave','entidad','anio','sexo_codigo','sexo','grupo_edad','tipo_seccion','LN','SV','NV','NS'];
  const observed = new Set<string>();
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Object.keys(row).length !== expectedFields.length || expectedFields.some(field => !Object.hasOwn(row,field)) ||
        !CCPC_YEARS.includes(row.anio as typeof CCPC_YEARS[number]) || !/^(0[1-9]|[12]\d|3[0-2])$/.test(row.entidad_clave) ||
        !Number.isInteger(row.sexo_codigo) || row.sexo_codigo < 0 || row.sexo_codigo > 2 || SEXES[row.sexo_codigo] !== row.sexo ||
        !AGE_GROUPS.includes(row.grupo_edad as typeof AGE_GROUPS[number]) || !SECTION_TYPES.includes(row.tipo_seccion as typeof SECTION_TYPES[number])) {
      throw new CivicParticipationError('INVALID_RAW_MAPPING', 'Las dimensiones de origen no corresponden al contrato acordado.');
    }
    const groupKey = key(row);
    if (observed.has(groupKey)) throw new CivicParticipationError('DUPLICATE_COMBINATION', `Combinación duplicada: ${groupKey}.`);
    observed.add(groupKey);
    const sourceRows = groupSourceRows.get(groupKey);
    if (typeof sourceRows !== 'number' || !Number.isSafeInteger(sourceRows) || sourceRows < 1) {
      throw new CivicParticipationError('INVALID_SOURCE_ROWS', `Falta un conteo positivo de filas de origen para ${groupKey}.`);
    }
  }
  if (groupSourceRows.size !== observed.size || [...groupSourceRows.keys()].some(groupKey => !observed.has(groupKey))) {
    throw new CivicParticipationError('INVALID_RAW_MAPPING', 'El mapa de procedencia contiene grupos adicionales o ausentes.');
  }
  const records = rows.map((row): ParticipationRecord => ({
    entityCode: row.entidad_clave, entityName: row.entidad, year: row.anio as ParticipationRecord['year'],
    sex: row.sexo as ParticipationRecord['sex'], ageGroup: row.grupo_edad,
    sectionType: row.tipo_seccion as ParticipationRecord['sectionType'],
    ...counts(row), ...calculateMetrics(counts(row)),
    sourceId: `${row.anio}:${row.entidad_clave}`, sourceRows: groupSourceRows.get(key(row)) ?? 0,
  })).sort(compareParticipationRecords);
  const sortedSources = [...sources].sort((a, b) => a.year - b.year || Number(a.entityCode) - Number(b.entityCode));
  return parseParticipationDataset({
    schemaVersion: 'ccpc-participation/v1', scope: 'entity', kind,
    years: [...new Set(records.map(record => record.year))].sort((a, b) => a - b),
    metricDefinitions: METRIC_DEFINITIONS, sources: sortedSources, records,
  });
}

/** Selección fija de grupos completos; conserva conteos y procedencia de cada grupo. */
export function selectParticipationSample(full: ParticipationDataset): ParticipationDataset {
  full = parseParticipationDataset(full);
  if (full.kind !== 'full') throw new CivicParticipationError('INVALID_KIND', 'La muestra requiere el conjunto completo validado.');
  const rows = [...full.records].sort(compareParticipationRecords);
  const selected = new Map<string, ParticipationRecord>();
  for (const year of full.years) for (const sex of SEXES) for (const sectionType of SECTION_TYPES) {
    for (const ageGroup of ['18-19', '20-24', '60-64', '100+']) {
      const row = rows.find(record => record.year === year && record.sex === sex && record.sectionType === sectionType && record.ageGroup === ageGroup);
      if (row) selected.set(participationKey(row), row);
    }
  }
  for (const year of full.years) {
    for (const predicate of [(row: ParticipationRecord) => row.unspecified > 0, (row: ParticipationRecord) => row.classified === 0]) {
      const row = rows.find(record => record.year === year && predicate(record));
      if (row) selected.set(participationKey(row), row);
    }
  }
  const records = [...selected.values()].sort(compareParticipationRecords);
  const used = new Set(records.map(record => record.sourceId));
  return parseParticipationDataset({ ...full, kind: 'sample', records, sources: full.sources.filter(source => used.has(source.id)) });
}

/** La CLI y la auditoría utilizan exactamente la misma transformación del resultado crudo. */
export function normalizeInspectedArchives(inspected: readonly Awaited<ReturnType<typeof inspectArchive>>[]) {
  const names = compareEntityNames(inspected.map(result => ({ year: result.report.year, names: result.report.names })));
  if (names.within_year_conflicts.length) throw new CivicParticipationError('ENTITY_NAME_CONFLICT', 'Nombres contradictorios dentro del año.');
  const sources = inspected.flatMap(result => result.report.members.map(member => ({
    id: `${result.report.year}:${member.entidad_clave}`,
    entityCode: member.entidad_clave, year: result.report.year, url: result.report.source_url,
    archiveSha256: result.report.archive_sha256, member: member.member,
    memberSha256: member.sha256, dictionarySha256: result.report.dictionary_sha256,
    downloadedAt: result.report.downloaded_at, rawRows: member.rows,
    totals: counts(member as unknown as { LN: number; SV: number; NV: number; NS: number }),
  }))) as ParticipationSource[];
  const groupRows = new Map(inspected.flatMap(result => [...result.groupSourceRows]));
  const full = normalizeAggregateRows(inspected.flatMap(result => result.rows), sources, groupRows);
  return { full, names };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.includes('--help')) {
    console.log(`node scripts/ccpc/normalize-data.ts [--year all|${CCPC_YEARS.join('|')}] [--zip-<año> PATH] [--output DIR] [--sample]\nSalida: data/ccpc/processed/data02. --sample añade data/ccpc/sample/data02 y requiere los seis años.`); return;
  }
  const options: Record<string, string> = {};
  let sample = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sample') {
      if (sample) throw new CivicParticipationError('INVALID_ARGUMENT', '--sample repetido.');
      sample = true; continue;
    }
    const option = args[i];
    if (!['--year', ...CCPC_YEARS.map(year => `--zip-${year}`), '--output'].includes(option) || !args[i + 1] || args[i + 1].startsWith('--') || option in options) {
      throw new CivicParticipationError('INVALID_ARGUMENT', `Argumento inválido o repetido: ${option}`);
    }
    options[option] = args[++i];
  }
  const year = parseSelectedYear(options['--year'] ?? 'all');
  if (sample && year !== 'all') throw new CivicParticipationError('INVALID_ARGUMENT', '--sample requiere los seis años.');
  const out = options['--output'] ? resolve(options['--output']) : join(ROOT, 'data/ccpc/processed/data02');
  assertFullOutputDirectory(out);
  const catalog = validateCatalog(JSON.parse(await readFile(join(ROOT, 'data/ccpc/sources.json'), 'utf8')), year);
  const inspected: Awaited<ReturnType<typeof inspectArchive>>[] = [];
  for (const source of catalog) {
    const path = options[`--zip-${source.year}`] ? resolve(options[`--zip-${source.year}`]) : join(ROOT, 'data/ccpc/raw', source.filename);
    inspected.push(await inspectArchive(source, path));
  }
  const { full, names } = normalizeInspectedArchives(inspected);
  // Todos los archivos oficiales y las dos salidas se validan antes de publicar.
  const fixture = sample ? selectParticipationSample(full) : undefined;
  await publishDataset(out, full);
  if (fixture) await publishDataset(join(ROOT, 'data/ccpc/sample/data02'), fixture);
  for (const change of names.changes) console.log(`Nombre original conservado: entidad ${change.entidad_clave}, ${JSON.stringify(change.names_by_year)}`);
  console.log(`DATA-02: ${full.records.length} grupos, ${full.sources.length} fuentes, ${full.sources.reduce((sum, source) => sum + source.rawRows, 0)} filas crudas. Salida: ${out}`);
  if (fixture) console.log(`Fixture DATA-02: ${fixture.records.length} grupos completos.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`ERROR: ${(error as Error).message}`); process.exitCode = 1; });
}
