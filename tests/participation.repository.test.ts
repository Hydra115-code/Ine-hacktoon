import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'csv-parse/sync';
import { validateFile } from '../scripts/ccpc/validate-data.ts';
import { createParticipationRepository } from '../src/repositories/participation.repository.ts';
import { ALLOWED_YEARS, CivicParticipationError, participationKey } from '../src/domain/civic/participation.ts';
import type { ParticipationDataset, ParticipationRecord, ParticipationSource } from '../src/domain/civic/participation.ts';
import type { EntityCode, ParticipationFilters } from '../src/application/ports/participation-data.ts';

// File verification belongs to the adapter/test, outside the pure repository.
const fixturePath = fileURLToPath(new URL('../data/ccpc/sample/data02/participation.json', import.meta.url));
const fixture = await validateFile(fixturePath);
const csv = parse(await readFile(new URL('../data/ccpc/sample/entidad.csv', import.meta.url)), { columns: true }) as Record<string, string>[];
const manifest = JSON.parse(await readFile(new URL('../data/ccpc/sample/data02/manifest.json', import.meta.url), 'utf8')) as { recordsSha256: string };
const repository = createParticipationRepository(fixture);

function keyFromCsv(row: Record<string, string>): string {
  return [row.anio, row.entidad_clave, row.sexo, row.grupo_edad, row.tipo_seccion].join('|');
}
function counts(rows: readonly ParticipationRecord[]) {
  return rows.reduce((sum, row) => ({
    LN: sum.LN + row.nominalList, SV: sum.SV + row.voted,
    NV: sum.NV + row.didNotVote, NS: sum.NS + row.unspecified,
  }), { LN: 0, SV: 0, NV: 0, NS: 0 });
}
function csvCounts(rows: readonly Record<string, string>[]) {
  return rows.reduce((sum, row) => ({
    LN: sum.LN + Number(row.LN), SV: sum.SV + Number(row.SV),
    NV: sum.NV + Number(row.NV), NS: sum.NS + Number(row.NS),
  }), { LN: 0, SV: 0, NV: 0, NS: 0 });
}

test('repository loads the real validated six-year fixture with DATA-02 manifest fingerprint', () => {
  assert.equal(fixture.kind, 'sample');
  assert.equal(fixture.records.length, 150);
  assert.equal(fixture.sources.length, 10);
  assert.deepEqual(repository.metadata, {
    schemaVersion: 'ccpc-participation/v1', kind: 'sample', years: [...ALLOWED_YEARS],
    recordsSha256: manifest.recordsSha256, validation: 'runtime_schema',
  });
  const actual = repository.selectRecords({});
  assert.equal(actual.length, csv.length);
  assert.deepEqual(actual.map(participationKey), csv.map(keyFromCsv));
  assert.deepEqual(counts(actual), csvCounts(csv));
});

test('all six year selectors return exactly their real CSV groups, counts and sources', () => {
  for (const year of ALLOWED_YEARS) {
    const expected = csv.filter(row => Number(row.anio) === year);
    const actual = repository.selectRecords({ year });
    assert.ok(actual.length > 0);
    assert.deepEqual(actual.map(participationKey), expected.map(keyFromCsv));
    assert.deepEqual(counts(actual), csvCounts(expected));
    assert.deepEqual(repository.selectSources({ year }).map(source => source.id), fixture.sources.filter(source => source.year === year).map(source => source.id));
  }
});

test('exact conjunction selects a documented 2009 group and preserves all its values', () => {
  const selected = repository.selectRecords({
    year: 2009, entityCodes: ['01'], sexes: ['hombre'], ageGroups: ['18-19'], sectionTypes: ['urbana'],
  });
  assert.equal(selected.length, 1);
  assert.equal(participationKey(selected[0]), '2009|01|hombre|18-19|urbana');
  assert.deepEqual(counts(selected), { LN: 12488, SV: 4070, NV: 6718, NS: 1700 });
  assert.equal(selected[0].participationRate, 4070 / 12488);
  assert.equal(selected[0].ccpcParticipationPct, (4070 / (4070 + 6718)) * 100);
  assert.equal(selected[0].sourceId, '2009:01');
});

test('arrays mean OR within a filter and AND across dimensions, without reordering evidence', () => {
  const filters: ParticipationFilters = {
    year: 2024, entityCodes: ['27', '01', '02'], sexes: ['no_binario', 'mujer'],
    ageGroups: ['20-24', '18-19'], sectionTypes: ['rural', 'mixta'],
  };
  const actual = repository.selectRecords(filters);
  const expected = csv.filter(row => row.anio === '2024' && ['01', '02', '27'].includes(row.entidad_clave)
    && ['mujer', 'no_binario'].includes(row.sexo) && ['18-19', '20-24'].includes(row.grupo_edad)
    && ['mixta', 'rural'].includes(row.tipo_seccion));
  assert.ok(actual.length > 0);
  assert.deepEqual(actual.map(participationKey), expected.map(keyFromCsv));
  assert.deepEqual(counts(actual), csvCounts(expected));
  assert.deepEqual(actual, repository.selectRecords({ ...filters, entityCodes: ['02', '01', '27'],
    sexes: ['mujer', 'no_binario'], ageGroups: ['18-19', '20-24'], sectionTypes: ['mixta', 'rural'] }));
});

test('empty matches retain documented year/entity source context and never fabricate records', () => {
  const filters: ParticipationFilters = { year: 2018, entityCodes: ['01'], sexes: ['no_binario'] };
  assert.deepEqual(repository.selectRecords(filters), []);
  assert.deepEqual(repository.selectSources(filters).map(source => source.id), ['2018:01']);
  assert.deepEqual(repository.selectSources({ year: 2018, entityCodes: ['32'] }), []);
  assert.deepEqual(repository.selectRecords({ year: 2018, entityCodes: ['32'] }), []);
  assert.deepEqual(repository.selectSources({ year: 2024, entityCodes: ['02'], ageGroups: ['100+'] }).map(source => source.id), ['2024:02']);
});

test('source selection matches real provenance, including hashes, member and acquisition date', () => {
  for (const record of repository.selectRecords({})) {
    const source = repository.selectSources({ year: record.year, entityCodes: [record.entityCode as EntityCode] });
    assert.equal(source.length, 1);
    assert.equal(source[0].id, record.sourceId);
    assert.deepEqual(source[0], fixture.sources.find(item => item.id === record.sourceId));
    assert.match(source[0].url, /^https:\/\/ine\.mx\//);
    for (const field of ['archiveSha256', 'memberSha256', 'dictionarySha256'] as const) assert.match(source[0][field], /^[a-f0-9]{64}$/);
    assert.ok(source[0].downloadedAt !== null);
  }
});

test('runtime filters reject unknown dimensions, coercion, empty/duplicate arrays and invalid categories', () => {
  const invalid: unknown[] = [
    null, [], '2024', { year: '2024' }, { year: 2010 }, { district: 1 }, { municipality: '001' },
    { entityCodes: ['1'] }, { entityCodes: ['00'] }, { entityCodes: ['33'] }, { entityCodes: [1] },
    { entityCodes: [] }, { entityCodes: ['01', '01'] }, { sexes: [] }, { sexes: ['total'] },
    { sexes: ['mujer', 'mujer'] }, { ageGroups: ['20-25'] }, { ageGroups: [] },
    { sectionTypes: ['U'] }, { sectionTypes: [] }, { sectionTypes: ['rural', 'rural'] },
  ];
  for (const filters of invalid) {
    assert.throws(() => repository.selectRecords(filters as ParticipationFilters));
    assert.throws(() => repository.selectSources(filters as ParticipationFilters));
  }
});

test('runtime dataset validation rejects inconsistent metrics, dimensions and provenance', () => {
  const alterations: Array<(dataset: ParticipationDataset) => void> = [
    data => { data.records[0].participationRate = 0; },
    data => { data.records[0].voted = -1; },
    data => { data.records[0].entityCode = '33'; },
    data => { data.records[0].sourceId = '2024:32'; },
    data => { data.sources[0].url = 'https://example.invalid/census.zip'; },
    data => { data.sources[0].memberSha256 = 'missing'; },
    data => { data.sources[0].downloadedAt = '2026-02-30T10:00:00Z'; },
    data => { data.records.push(structuredClone(data.records[0])); },
    data => { data.records = []; },
  ];
  for (const alter of alterations) {
    const changed = structuredClone(fixture);
    alter(changed);
    assert.throws(() => createParticipationRepository(changed), CivicParticipationError);
  }
  assert.throws(() => createParticipationRepository({ ...fixture, municipality: '001' }), CivicParticipationError);
});

test('factory and queries never mutate caller input and cannot be changed through returned aliases', () => {
  const input = structuredClone(fixture);
  const before = structuredClone(input);
  const repo = createParticipationRepository(input);
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.records[0]), false);
  input.records[0].nominalList = 999;
  input.sources[0].totals.nominalList = 999;
  input.years.splice(0);
  assert.deepEqual(repo.selectRecords({}), before.records);
  assert.deepEqual(repo.selectSources({}), before.sources);
  const rows = repo.selectRecords({});
  const sources = repo.selectSources({});
  assert.throws(() => (rows as ParticipationRecord[]).pop(), TypeError);
  assert.throws(() => { rows[0].voted = 999; }, TypeError);
  assert.throws(() => { sources[0].totals.nominalList = 999; }, TypeError);
  assert.throws(() => (sources as ParticipationSource[]).splice(0), TypeError);
  assert.throws(() => repo.metadata.years.splice(0), TypeError);
  assert.throws(() => { (repo.metadata as { recordsSha256: string }).recordsSha256 = 'changed'; }, TypeError);
  assert.deepEqual(repo.selectRecords({}), before.records);
});

test('repeated construction and selections are deterministic and retain canonical evidence order', () => {
  const other = createParticipationRepository(structuredClone(fixture));
  assert.deepEqual(other.metadata, repository.metadata);
  const filters: ParticipationFilters = { year: 2024, sexes: ['mujer', 'hombre'], ageGroups: ['60-64', '18-19'] };
  const beforeFilters = structuredClone(filters);
  const first = repository.selectRecords(filters);
  for (let index = 0; index < 5; index++) {
    assert.deepEqual(repository.selectRecords(filters), first);
    assert.deepEqual(other.selectRecords(filters), first);
    assert.deepEqual(other.selectSources(filters), repository.selectSources(filters));
  }
  assert.deepEqual(filters, beforeFilters);
});
