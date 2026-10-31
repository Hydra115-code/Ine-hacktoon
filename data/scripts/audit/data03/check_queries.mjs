// Independent execution audit. Writes only its report in data/ccpc/processed/audit-data03/.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createParticipationRepository } from '../../../src/repositories/participation.repository.ts';
import { createParticipationService } from '../../../src/services/participation.service.ts';
import { validateFile } from '../../../scripts/ccpc/validate-data.ts';
import {
  participationSummarySchema, electionComparisonSchema, participationBreakdownSchema, supportingRecordsSchema,
} from '../../../src/application/ports/participation-data.ts';

const here = new URL('../../../data/ccpc/processed/audit-data03/', import.meta.url);
const expected = JSON.parse(await readFile(new URL('expected-results.json', here), 'utf8'));
const fullPath = fileURLToPath(new URL('../../../data/ccpc/processed/data02/participation.json', import.meta.url));
const fixturePath = fileURLToPath(new URL('../../../data/ccpc/sample/data02/participation.json', import.meta.url));
const full = await validateFile(fullPath);
const fixture = await validateFile(fixturePath);
const service = createParticipationService(createParticipationRepository(full));
const fixtureService = createParticipationService(createParticipationRepository(fixture));
const countFields = ['nominalList', 'voted', 'didNotVote', 'unspecified'];
const checks = [];
const outputs = {};
const add = (name, operation) => { operation(); checks.push(name); };
const approx = (actual, value, label) => {
  if (value === null) assert.equal(actual, null, label);
  else assert.ok(typeof actual === 'number' && Math.abs(actual - value) < 1e-11, `${label}: ${actual} != ${value}`);
};
const warningCodes = output => output.warnings.map(warning => warning.code);
const sourceMap = new Map(full.sources.map(source => [source.id, source]));

function checkEvidence(output, expectedResult, schema) {
  assert.equal(schema.safeParse(output).success, true);
  assert.equal(output.evidence.matchedRecords, expectedResult.recordCount);
  assert.equal(output.evidence.matchedSourceRows, expectedResult.sourceRows);
  for (const source of output.evidence.sources) {
    assert.deepEqual(source, sourceMap.get(source.id));
    assert.match(source.url, /^https:\/\/ine\.mx\//);
    assert.match(source.archiveSha256, /^[a-f0-9]{64}$/);
    assert.match(source.memberSha256, /^[a-f0-9]{64}$/);
    assert.match(source.dictionarySha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(output.evidence.contributions.map(item => item.sourceId).sort(), expectedResult.sourceIds);
  for (const catalog of output.evidence.catalogSources) {
    assert.ok(full.sources.some(source => source.year === catalog.year && source.url === catalog.url));
  }
  assert.ok(output.evidence.catalogSources.length > 0);
  assert.equal(output.units.rateUnit, 'ratio');
  assert.equal(output.units.percentageUnit, 'percent');
  assert.equal(output.units.comparisonUnit, 'percentage_point');
  assert.equal(output.evidence.dataset.kind, 'full');
  assert.equal(output.evidence.dataset.validation, 'runtime_schema');
}

function checkSummary(output, expectedResult) {
  checkEvidence(output, expectedResult, participationSummarySchema);
  for (const key of countFields) assert.equal(output.totals[key], expectedResult.counts[key]);
  for (const [key, value] of Object.entries(expectedResult.metrics)) approx(output.totals[key], value, key);
}

for (const [name, filters] of [['national2024', { year: 2024 }], ['national2018', { year: 2018 }], ['colima2024', { year: 2024, entityCodes: ['06'] }]]) {
  const result = service.getParticipationSummary(filters);
  add(`full summary ${name}: independent counts, metrics, Zod and actual provenance`, () => checkSummary(result, expected.summaries[name]));
  outputs[name] = { filters: result.filters, totals: result.totals, matchedRecords: result.evidence.matchedRecords,
    matchedSourceRows: result.evidence.matchedSourceRows, sourceIds: result.evidence.sources.map(item => item.id), warningCodes: warningCodes(result) };
}

const years = [2024, 2018];
const comparison = service.compareElections({}, years);
add('comparison: independent percentage points and relative percent; requested years untouched', () => {
  assert.deepEqual(years, [2024, 2018]);
  assert.deepEqual(comparison.years, [2018, 2024]);
  assert.equal(electionComparisonSchema.safeParse(comparison).success, true);
  approx(comparison.changes[0].participationPercentagePoints, expected.comparison2018To2024.participationDifferencePercentagePoints, 'nominal pp');
  approx(comparison.changes[0].ccpcParticipationPercentagePoints, expected.comparison2018To2024.ccpcParticipationDifferencePercentagePoints, 'CCPC pp');
  approx(comparison.changes[0].participationRelativePercent, expected.comparison2018To2024.relativeParticipationChangePercent, 'relative percent');
  assert.equal('totals' in comparison, false);
  for (const item of comparison.elections) checkSummary(item.summary, expected.summaries[`national${item.year}`]);
  for (const code of ['ELECTIONS_NOT_A_PANEL', 'CARTOGRAPHIC_FRAMES_DIFFER', 'SEX_CATEGORIES_CHANGED', 'ENTITY_LABEL_CHANGED', 'NS_EXCLUDED_FROM_CCPC']) {
    assert.ok(warningCodes(comparison).includes(code), code);
  }
});
outputs.comparison2018To2024 = { changes: comparison.changes, warningCodes: warningCodes(comparison), sourceCount: comparison.evidence.sources.length };

for (const dimension of ['sex', 'sectionType']) {
  const result = service.getParticipationBreakdown({ year: 2024 }, dimension);
  const reference = expected.breakdowns[`${dimension}2024`];
  add(`breakdown ${dimension}: independent buckets, counts conserved, actual sources`, () => {
    assert.equal(participationBreakdownSchema.safeParse(result).success, true);
    assert.deepEqual(result.groups.map(group => group.value), reference.groups.map(group => group.value));
    for (const [index, group] of result.groups.entries()) checkSummary(group.summary, reference.groups[index]);
    for (const key of countFields) assert.equal(result.groups.reduce((sum, group) => sum + group.summary.totals[key], 0), expected.summaries.national2024.counts[key]);
  });
  outputs[`${dimension}2024`] = result.groups.map(group => ({ value: group.value, totals: group.summary.totals, warningCodes: warningCodes(group.summary) }));
}

const supportFilters = { year: 2024, entityCodes: ['01'], sexes: ['hombre'], ageGroups: ['18-19'], sectionTypes: ['urbana'] };
const support = service.getSupportingRecords(supportFilters);
add('support: exact independent AGS source record and provenance', () => {
  assert.equal(supportingRecordsSchema.safeParse(support).success, true);
  assert.deepEqual(support.records, expected.supportingRecords.records);
  assert.deepEqual(support.evidence.sources, expected.supportingRecords.sources);
  assert.equal(support.evidence.matchedSourceRows, 1025);
});
outputs.support = support;

add('default: latest year explicit in filters and warning; no sum across elections', () => {
  const result = service.getParticipationSummary({});
  assert.equal(result.filters.year, 2024);
  assert.deepEqual(result.totals, service.getParticipationSummary({ year: 2024 }).totals);
  assert.ok(warningCodes(result).includes('DEFAULT_YEAR_SELECTED'));
});
add('missing historical non-binary: no data, no fabricated zero, source context retained', () => {
  const result = service.getParticipationSummary({ year: 2018, sexes: ['no_binario'] });
  assert.equal(result.status, 'no_data');
  assert.equal(result.totals, null);
  assert.equal(result.evidence.matchedRecords, 0);
  assert.ok(result.evidence.sources.length > 0);
  for (const code of ['NON_BINARY_UNAVAILABLE', 'NO_MATCHING_RECORDS']) assert.ok(warningCodes(result).includes(code));
  const compare = service.compareElections({ sexes: ['no_binario'] }, [2018, 2024]);
  assert.equal(compare.elections[0].summary.totals, null);
  assert.equal(compare.changes[0].participationPercentagePoints, null);
  assert.equal(compare.changes[0].participationRelativePercent, null);
});
add('comparability: section frame change; small cells; code09 historical labels', () => {
  assert.ok(warningCodes(service.compareElections({ sectionTypes: ['urbana'] }, [2018, 2024])).includes('SECTION_TYPES_MAY_CHANGE'));
  assert.ok(warningCodes(service.getSupportingRecords({ year: 2024, sexes: ['no_binario'] })).includes('SMALL_CELLS'));
  const code09 = service.compareElections({ entityCodes: ['09'] }, [2018, 2024]);
  assert.ok(warningCodes(code09).includes('ENTITY_LABEL_CHANGED'));
});
add('fixture results: independently checked sums and explicit partial warning', () => {
  for (const year of [2009, 2012, 2015, 2018, 2021, 2024]) {
    const result = fixtureService.getParticipationSummary({ year });
    const reference = expected.fixture.summariesByYear.find(item => item.filters.year === year);
    for (const key of countFields) assert.equal(result.totals[key], reference.counts[key]);
    for (const [key, value] of Object.entries(reference.metrics)) approx(result.totals[key], value, key);
    assert.equal(result.evidence.dataset.kind, 'sample');
    assert.ok(warningCodes(result).includes('SAMPLE_DATA'));
  }
  for (const result of [fixtureService.compareElections({}, [2018, 2024]), fixtureService.getParticipationBreakdown({ year: 2024 }, 'sex'), fixtureService.getSupportingRecords(supportFilters)]) {
    assert.ok(warningCodes(result).includes('SAMPLE_DATA'));
  }
});
add('strict invalid filters and dimensions rejected', () => {
  for (const input of [{ year: 2010 }, { year: '2024' }, { entityCodes: [] }, { entityCodes: ['00'] }, { entityCodes: ['01', '01'] }, { sexes: ['unknown'] }, { ageGroups: ['18-24'] }, { sectionTypes: ['U'] }, { municipio: '001' }]) {
    assert.throws(() => service.getParticipationSummary(input), JSON.stringify(input));
  }
  assert.throws(() => service.getParticipationBreakdown({}, 'municipality'));
  assert.throws(() => service.compareElections({ year: 2024 }, [2018, 2024]));
  assert.throws(() => service.compareElections({}, [2024, 2024]));
});
add('all five breakdown dimensions: record/row coverage and counts conservation', () => {
  for (const dimension of ['entity', 'year', 'sex', 'ageGroup', 'sectionType']) {
    const result = service.getParticipationBreakdown({ year: 2024 }, dimension);
    assert.equal(result.groups.reduce((sum, group) => sum + group.summary.evidence.matchedRecords, 0), expected.summaries.national2024.recordCount);
    assert.equal(result.groups.reduce((sum, group) => sum + group.summary.evidence.matchedSourceRows, 0), expected.summaries.national2024.sourceRows);
    for (const key of countFields) assert.equal(result.groups.reduce((sum, group) => sum + group.summary.totals[key], 0), expected.summaries.national2024.counts[key]);
  }
});
add('repeated queries deterministic; consumer response mutation cannot change snapshot', () => {
  for (const [query, args] of [['getParticipationSummary', [{ year: 2024 }]], ['compareElections', [{}, [2018, 2024]]], ['getParticipationBreakdown', [{ year: 2024 }, 'sex']], ['getSupportingRecords', [supportFilters]]]) {
    assert.equal(JSON.stringify(service[query](...args)), JSON.stringify(service[query](...args)));
  }
  const response = service.getSupportingRecords(supportFilters);
  response.records[0].nominalList = 0;
  response.evidence.sources[0].totals.nominalList = 0;
  assert.deepEqual(service.getSupportingRecords(supportFilters).records, expected.supportingRecords.records);
  assert.deepEqual(service.getSupportingRecords(supportFilters).evidence.sources, expected.supportingRecords.sources);
});

const report = { status: 'PASS', checkCount: checks.length, checks,
  expectedSha256: createHash('sha256').update(await readFile(new URL('expected-results.json', here))).digest('hex'),
  fullDatasetSha256: createHash('sha256').update(await readFile(fullPath)).digest('hex'),
  fixtureDatasetSha256: createHash('sha256').update(await readFile(fixturePath)).digest('hex'), outputs };
await writeFile(new URL('query-execution-report.json', here), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checkCount: checks.length, checks, report: fileURLToPath(new URL('query-execution-report.json', here)) }, null, 2));
