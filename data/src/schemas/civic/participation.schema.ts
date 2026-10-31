import {
  AGE_GROUPS, ALLOWED_YEARS, CivicParticipationError, METRIC_DEFINITIONS, SECTION_TYPES,
  SEXES, participationKey, compareParticipationRecords, entityNameForYear, officialSourceUrl, officialSourceMember, sourceIdForEntity,
} from '../../domain/civic/participation.ts';
import type { ParticipationDataset, ParticipationRecord, ParticipationSource } from '../../domain/civic/participation.ts';

type ObjectValue = Record<string, unknown>;
const COUNT_FIELDS = ['nominalList', 'voted', 'didNotVote', 'unspecified'] as const;
const RECORD_FIELDS = [
  'entityCode', 'entityName', 'year', 'sex', 'ageGroup', 'sectionType', ...COUNT_FIELDS,
  'classified', 'participationRate', 'abstentionRate', 'unspecifiedRate', 'participationPct',
  'abstentionPct', 'unspecifiedPct', 'ccpcParticipationPct', 'ccpcAbstentionPct', 'sourceId', 'sourceRows',
] as const;
const SOURCE_FIELDS = [
  'id', 'entityCode', 'year', 'url', 'archiveSha256', 'member', 'memberSha256',
  'dictionarySha256', 'downloadedAt', 'rawRows', 'totals',
] as const;
const DATASET_FIELDS = ['schemaVersion', 'scope', 'kind', 'years', 'metricDefinitions', 'sources', 'records'] as const;
const OFFICIAL_HOSTS = new Set(['ine.mx', 'www.ine.mx', 'portal.ine.mx']);
const ANNUAL_SOURCE_FIELDS = ['url', 'archiveSha256', 'dictionarySha256', 'downloadedAt'] as const;

function fail(code: string, message: string, path: string): never {
  throw new CivicParticipationError(code, message, path);
}
function object(input: unknown, fields: readonly string[], path: string): ObjectValue {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    fail('INVALID_OBJECT', 'Se requiere un objeto.', path);
  }
  const value = input as ObjectValue;
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail('UNKNOWN_FIELD', `Campo no permitido: ${key}.`, `${path}.${key}`);
  }
  for (const key of fields) {
    if (!Object.hasOwn(value, key)) fail('MISSING_FIELD', `Falta el campo ${key}.`, `${path}.${key}`);
  }
  return value;
}
function text(input: unknown, path: string): string {
  if (typeof input !== 'string' || input.length === 0 || input !== input.trim() || /[\u0000-\u001f\u007f\ud800-\udfff]/u.test(input)) {
    // The surrogate expression rejects isolated UTF-16 surrogates, not valid supplementary characters.
    fail('INVALID_TEXT', 'Se requiere texto no vacío, sin controles ni espacios exteriores.', path);
  }
  return input;
}
function integer(input: unknown, path: string, minimum = 0): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < minimum) {
    fail('INVALID_COUNT', `Se requiere entero seguro mayor o igual a ${minimum}.`, path);
  }
  return input;
}
function choice<T extends string | number>(input: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(input as T)) fail('INVALID_CATEGORY', `Valor no permitido: ${String(input)}.`, path);
  return input as T;
}
function entityCode(input: unknown, path: string): string {
  const value = text(input, path);
  if (!/^(0[1-9]|[12]\d|3[0-2])$/.test(value)) fail('INVALID_ENTITY', 'La entidad debe ser una clave de 01 a 32.', path);
  return value;
}
function counts(value: ObjectValue, path: string) {
  const result = {
    nominalList: integer(value.nominalList, `${path}.nominalList`),
    voted: integer(value.voted, `${path}.voted`),
    didNotVote: integer(value.didNotVote, `${path}.didNotVote`),
    unspecified: integer(value.unspecified, `${path}.unspecified`),
  };
  for (const field of ['voted', 'didNotVote', 'unspecified'] as const) {
    if (result[field] > result.nominalList) fail('NUMERATOR_EXCEEDS_UNIVERSE', `${field} excede nominalList.`, `${path}.${field}`);
  }
  const total = result.voted + result.didNotVote + result.unspecified;
  if (!Number.isSafeInteger(total)) fail('COUNT_OVERFLOW', 'La suma de conteos excede el rango seguro.', path);
  if (total !== result.nominalList) fail('COUNT_PARTITION', 'nominalList debe ser voted + didNotVote + unspecified.', path);
  return result;
}
function metric(input: unknown, expected: number | null, path: string, maximum: number): number | null {
  if (expected === null) {
    if (input !== null) fail('ZERO_DENOMINATOR', 'Con denominador cero la métrica debe ser null.', path);
    return null;
  }
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0 || input > maximum) {
    fail('INVALID_METRIC', `La métrica debe ser finita y estar entre 0 y ${maximum}.`, path);
  }
  if (input !== expected) {
    fail('METRIC_MISMATCH', `La métrica no corresponde a sus conteos y denominador (esperado ${expected}).`, path);
  }
  return input;
}

/** Strict runtime contract. Unknown properties are rejected, including finer geographic dimensions. */
export function parseParticipationRecord(input: unknown, path = 'record'): ParticipationRecord {
  const value = object(input, RECORD_FIELDS, path);
  const year = choice(value.year, ALLOWED_YEARS, `${path}.year`);
  const sex = choice(value.sex, SEXES, `${path}.sex`);
  if (year !== 2024 && sex === 'no_binario') fail('INVALID_CATEGORY', 'No binario solo está documentado en 2024.', `${path}.sex`);
  const code = entityCode(value.entityCode, `${path}.entityCode`);
  const name = text(value.entityName, `${path}.entityName`);
  if (name !== entityNameForYear(year,code)) fail('ENTITY_NAME_MISMATCH','El nombre no corresponde al original del año y entidad.',`${path}.entityName`);
  if (value.sourceId !== sourceIdForEntity(year,code)) fail('INVALID_SOURCE_ID','sourceId debe ser año:entidad.',`${path}.sourceId`);
  const count = counts(value, path);
  const classified = integer(value.classified, `${path}.classified`);
  if (classified !== count.voted + count.didNotVote) fail('COUNT_PARTITION', 'classified debe ser voted + didNotVote.', `${path}.classified`);
  const ratio = (numerator: number) => count.nominalList === 0 ? null : numerator / count.nominalList;
  const pct = (ratioValue: number | null) => ratioValue === null ? null : ratioValue * 100;
  const ccpc = (numerator: number) => classified === 0 ? null : (numerator / classified) * 100;
  const participationRate = ratio(count.voted);
  const abstentionRate = ratio(count.didNotVote);
  const unspecifiedRate = ratio(count.unspecified);
  return {
    entityCode: code,
    entityName: name, year, sex,
    ageGroup: choice(value.ageGroup, AGE_GROUPS, `${path}.ageGroup`),
    sectionType: choice(value.sectionType, SECTION_TYPES, `${path}.sectionType`), ...count, classified,
    participationRate: metric(value.participationRate, participationRate, `${path}.participationRate`, 1),
    abstentionRate: metric(value.abstentionRate, abstentionRate, `${path}.abstentionRate`, 1),
    unspecifiedRate: metric(value.unspecifiedRate, unspecifiedRate, `${path}.unspecifiedRate`, 1),
    participationPct: metric(value.participationPct, pct(participationRate), `${path}.participationPct`, 100),
    abstentionPct: metric(value.abstentionPct, pct(abstentionRate), `${path}.abstentionPct`, 100),
    unspecifiedPct: metric(value.unspecifiedPct, pct(unspecifiedRate), `${path}.unspecifiedPct`, 100),
    ccpcParticipationPct: metric(value.ccpcParticipationPct, ccpc(count.voted), `${path}.ccpcParticipationPct`, 100),
    ccpcAbstentionPct: metric(value.ccpcAbstentionPct, ccpc(count.didNotVote), `${path}.ccpcAbstentionPct`, 100),
    sourceId: text(value.sourceId, `${path}.sourceId`),
    sourceRows: integer(value.sourceRows, `${path}.sourceRows`, 1),
  };
}
function hash(input: unknown, path: string): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{64}$/.test(input)) fail('INVALID_HASH', 'Se requiere SHA-256 hexadecimal en minúsculas de 64 caracteres.', path);
  return input;
}
function officialUrl(input: unknown, path: string): string {
  const value = text(input, path);
  let url: URL;
  try { url = new URL(value); } catch { return fail('INVALID_SOURCE_URL', 'URL de origen inválida.', path); }
  if (url.protocol !== 'https:' || !OFFICIAL_HOSTS.has(url.hostname) || url.username || url.password || url.port || url.hash) {
    fail('INVALID_SOURCE_URL', 'El origen debe ser HTTPS de INE, sin credenciales, puerto ni fragmento.', path);
  }
  return value;
}
function downloadDate(input: unknown, path: string): string | null {
  if (input === null) return null;
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input)) {
    fail('INVALID_DOWNLOAD_DATE', 'La fecha debe ser ISO UTC con Z o null si no se conoce.', path);
  }
  const timestamp = Date.parse(input);
  const canonical = input.includes('.') ? input : input.replace('Z', '.000Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== canonical) {
    fail('INVALID_DOWNLOAD_DATE', 'La fecha de descarga no es una fecha real.', path);
  }
  return input;
}
export function parseParticipationSource(input: unknown, path = 'source'): ParticipationSource {
  const value = object(input, SOURCE_FIELDS, path);
  const year = choice(value.year, ALLOWED_YEARS, `${path}.year`);
  const code = entityCode(value.entityCode, `${path}.entityCode`);
  const id = text(value.id, `${path}.id`);
  if (id !== `${year}:${code}`) fail('INVALID_SOURCE_ID', 'id debe corresponder a año:entidad.', `${path}.id`);
  const member = text(value.member, `${path}.member`);
  if (!/\.csv$/i.test(member) || /[\\:]/.test(member) || member.startsWith('/') || member.split('/').some(part => part === '' || part === '.' || part === '..')) {
    fail('INVALID_SOURCE_MEMBER', 'member debe ser una ruta CSV relativa segura dentro del ZIP.', `${path}.member`);
  }
  if (member !== officialSourceMember(year,code)) fail('INVALID_SOURCE_MEMBER','El miembro no corresponde al CSV documentado del corte y entidad.',`${path}.member`);
  if (value.url !== officialSourceUrl(year)) fail('INVALID_SOURCE_URL','La URL no corresponde al archivo oficial del año.',`${path}.url`);
  const totals = counts(object(value.totals, COUNT_FIELDS, `${path}.totals`), `${path}.totals`);
  return {
    id, entityCode: code, year, member, totals,
    url: officialUrl(value.url, `${path}.url`),
    archiveSha256: hash(value.archiveSha256, `${path}.archiveSha256`),
    memberSha256: hash(value.memberSha256, `${path}.memberSha256`),
    dictionarySha256: hash(value.dictionarySha256, `${path}.dictionarySha256`),
    downloadedAt: downloadDate(value.downloadedAt, `${path}.downloadedAt`),
    rawRows: integer(value.rawRows, `${path}.rawRows`, 1),
  };
}
function array(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input) || input.length === 0) fail('INVALID_ARRAY', 'Se requiere un arreglo no vacío.', path);
  for (let index = 0; index < input.length; index++) {
    if (!Object.hasOwn(input, index)) fail('INVALID_ARRAY', 'No se permiten posiciones vacías en el arreglo.', `${path}[${index}]`);
  }
  return input;
}
function addSafe(left: number, right: number, path: string): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) fail('COUNT_OVERFLOW', 'La suma del conjunto excede el rango entero seguro.', path);
  return sum;
}

/** Validates metric units, provenance, unique combinations and count/row conservation. Never sorts or repairs data. */
export function parseParticipationDataset(input: unknown): ParticipationDataset {
  const value = object(input, DATASET_FIELDS, 'dataset');
  if (value.schemaVersion !== 'ccpc-participation/v1') fail('INVALID_SCHEMA_VERSION', 'Versión de esquema no compatible.', 'dataset.schemaVersion');
  if (value.scope !== 'entity') fail('INVALID_SCOPE', 'DATA-02 solo admite nivel entidad.', 'dataset.scope');
  const kind = choice(value.kind, ['full', 'sample'] as const, 'dataset.kind');
  const years = array(value.years, 'dataset.years').map((year, index) => choice(year, ALLOWED_YEARS, `dataset.years[${index}]`));
  if (new Set(years).size !== years.length || years.some((year, index) => index > 0 && year <= years[index - 1])) {
    fail('INVALID_YEARS', 'Los años deben ser únicos y estar ordenados ascendentemente.', 'dataset.years');
  }
  const definitions = object(value.metricDefinitions, Object.keys(METRIC_DEFINITIONS), 'dataset.metricDefinitions');
  for (const [key, expected] of Object.entries(METRIC_DEFINITIONS)) {
    if (definitions[key] !== expected) fail('INVALID_METRIC_DEFINITION', `Unidad o denominador incompatible para ${key}.`, `dataset.metricDefinitions.${key}`);
  }
  const sources = array(value.sources, 'dataset.sources').map((source, index) => parseParticipationSource(source, `dataset.sources[${index}]`));
  const records = array(value.records, 'dataset.records').map((record, index) => parseParticipationRecord(record, `dataset.records[${index}]`));
  const sourceMap = new Map<string, ParticipationSource>();
  const annualSources = new Map<number, ParticipationSource>();
  const annualMembers = new Set<string>();
  for (const [index, source] of sources.entries()) {
    if (!years.includes(source.year)) fail('SOURCE_YEAR_MISMATCH', 'El año de la fuente no está incluido en years.', `dataset.sources[${index}].year`);
    if (sourceMap.has(source.id)) fail('DUPLICATE_SOURCE', `Fuente duplicada: ${source.id}.`, `dataset.sources[${index}].id`);
    const annualSource = annualSources.get(source.year);
    if (annualSource) {
      for (const field of ANNUAL_SOURCE_FIELDS) {
        if (source[field] !== annualSource[field]) {
          fail('INCONSISTENT_ANNUAL_SOURCE', `Todas las entidades de ${source.year} deben compartir ${field} del mismo ZIP y diccionario.`, `dataset.sources[${index}].${field}`);
        }
      }
    } else annualSources.set(source.year, source);
    const memberKey = `${source.year}:${source.member}`;
    if (annualMembers.has(memberKey)) fail('DUPLICATE_SOURCE_MEMBER', 'Un CSV del ZIP no puede representar más de una fuente del mismo año.', `dataset.sources[${index}].member`);
    annualMembers.add(memberKey);
    sourceMap.set(source.id, source);
  }
  const keys = new Set<string>();
  const seenNames = new Map<string, string>();
  const sums = new Map<string, { sourceRows: number; nominalList: number; voted: number; didNotVote: number; unspecified: number }>();
  for (const [index, record] of records.entries()) {
    const path = `dataset.records[${index}]`;
    const source = sourceMap.get(record.sourceId);
    if (!source) fail('UNKNOWN_SOURCE', 'sourceId no corresponde a una fuente documentada.', `${path}.sourceId`);
    if (source.year !== record.year || source.entityCode !== record.entityCode || !years.includes(record.year)) {
      fail('SOURCE_DIMENSION_MISMATCH', 'Año y entidad deben coincidir con la fuente.', path);
    }
    if (record.sourceRows > source.rawRows) fail('SOURCE_ROWS_EXCEEDED', 'sourceRows excede las filas originales de la fuente.', `${path}.sourceRows`);
    const key = participationKey(record);
    if (keys.has(key)) fail('DUPLICATE_COMBINATION', `Combinación duplicada: ${key}.`, path);
    keys.add(key);
    const previousName = seenNames.get(record.sourceId);
    if (previousName !== undefined && previousName !== record.entityName) fail('INCONSISTENT_ENTITY_NAME', 'Nombres distintos para la misma entidad y año.', `${path}.entityName`);
    seenNames.set(record.sourceId, record.entityName);
    const total = sums.get(record.sourceId) ?? { sourceRows: 0, nominalList: 0, voted: 0, didNotVote: 0, unspecified: 0 };
    total.sourceRows = addSafe(total.sourceRows, record.sourceRows, `${path}.sourceRows`);
    for (const field of COUNT_FIELDS) total[field] = addSafe(total[field], record[field], `${path}.${field}`);
    sums.set(record.sourceId, total);
  }
  for (let index = 1; index < records.length; index++) {
    if (compareParticipationRecords(records[index-1],records[index]) > 0) fail('INVALID_RECORD_ORDER','El orden de registros debe ser canónico.',`dataset.records[${index}]`);
  }
  for (let index = 1; index < sources.length; index++) {
    const before=sources[index-1], current=sources[index];
    if (before.year>current.year || (before.year===current.year && Number(before.entityCode)>Number(current.entityCode))) fail('INVALID_SOURCE_ORDER','El orden de fuentes debe ser año/entidad.',`dataset.sources[${index}]`);
  }
  for (const [index, source] of sources.entries()) {
    const path = `dataset.sources[${index}]`;
    const total = sums.get(source.id);
    if (!total) fail('UNUSED_SOURCE', 'Una fuente no tiene registros asociados.', path);
    if (kind === 'full' ? total.sourceRows !== source.rawRows : total.sourceRows > source.rawRows) {
      fail('ROW_CONSERVATION', 'Las filas asociadas no conservan el universo documentado de la fuente.', `${path}.rawRows`);
    }
    for (const field of COUNT_FIELDS) {
      if (kind === 'full' ? total[field] !== source.totals[field] : total[field] > source.totals[field]) {
        fail('COUNT_CONSERVATION', `Los registros no conservan el total de ${field} de la fuente.`, `${path}.totals.${field}`);
      }
    }
  }
  for (const year of years) {
    const entitySources = sources.filter(source => source.year === year);
    if (entitySources.length === 0 || (kind === 'full' && entitySources.length !== 32)) {
      fail('ENTITY_COVERAGE', kind === 'full' ? 'Un conjunto completo debe contener las 32 entidades por año.' : 'Cada año debe tener al menos una entidad.', 'dataset.sources');
    }
  }
  return {
    schemaVersion: 'ccpc-participation/v1', scope: 'entity', kind, years,
    metricDefinitions: { ...METRIC_DEFINITIONS }, sources, records,
  };
}

/** Dependency-free runtime schema facade for backend callers. */
export const participationSchema = {
  parse: parseParticipationDataset,
  safeParse(input: unknown): { success: true; data: ParticipationDataset } | { success: false; error: CivicParticipationError } {
    try { return { success: true, data: parseParticipationDataset(input) }; }
    catch (error) {
      if (error instanceof CivicParticipationError) return { success: false, error };
      throw error;
    }
  },
};
