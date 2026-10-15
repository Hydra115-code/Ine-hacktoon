import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAcquisition, validateCatalog, validateDownloadManifest } from '../scripts/ccpc/validation.ts';
import type { DownloadRecord, Source } from '../scripts/ccpc/download-data.ts';
import { CCPC_YEARS, isCcpcYear, parseSelectedYear } from '../scripts/ccpc/years.ts';
import type { SelectedYear } from '../scripts/ccpc/years.ts';

const SOURCES: Source[] = CCPC_YEARS.map((year, index) => ({
  year,
  filename: `ccpc-${year}.zip`,
  url: `https://portal.ine.mx/ccpc-${year}.zip`,
  landing_url: 'https://ine.mx/ccpc/',
  sha256: (index + 10).toString(16).repeat(64),
}));
const catalog = () => ({ schema_version: 1, sources: SOURCES.map(source => ({ ...source })) });
const SOURCE = SOURCES[5];
const RECORD: DownloadRecord = {
  year: 2024, url: SOURCE.url, final_url: 'https://www.ine.mx/ccpc-final.zip',
  sha256: SOURCE.sha256, bytes: 100, downloaded_at: '2026-10-12T12:00:00.000Z',
  verified_at: '2026-10-12T13:00:00.000Z',
};
const manifest = (record: unknown = RECORD) => ({ schema_version: 1, downloads: [record] });

test('catalog validates exactly all six sources before filtering a selected year', () => {
  assert.deepEqual(validateCatalog(catalog(), 'all'), SOURCES);
  for (const source of SOURCES) {
    assert.deepEqual(validateCatalog(catalog(), String(source.year) as SelectedYear), [source]);
  }
  const missingOtherYear = { schema_version: 1, sources: SOURCES.slice(1) };
  assert.throws(() => validateCatalog(missingOtherYear, '2024'), /exactamente/);
  assert.throws(() => validateCatalog({ schema_version: 1, sources: [] }, 'all'), /exactamente/);
  assert.throws(() => validateCatalog({ schema_version: 1, sources: [...SOURCES, SOURCES[0]] }, 'all'), /exactamente/);
  assert.throws(() => validateCatalog(catalog(), '2026' as SelectedYear), /Año solicitado/);
});

test('catalog rejects malformed schema, duplicate years or URLs, unsafe names and unofficial sources before filtering', () => {
  const badSources = [
    { ...SOURCES[0], year: 2024 },
    { ...SOURCES[0], year: '2009' },
    { ...SOURCES[0], year: 2009.5 },
    { ...SOURCES[0], year: 2026 },
    { ...SOURCES[0], sha256: 'pending' },
    { ...SOURCES[0], url: 'https://ine.mx.evil.test/archive.zip' },
    { ...SOURCES[0], url: SOURCES[1].url },
    { ...SOURCES[0], landing_url: 'http://ine.mx/ccpc/' },
    { ...SOURCES[0], filename: '../archive.zip' },
    { ...SOURCES[0], filename: '..\\archive.zip' },
    { ...SOURCES[0], filename: 'C:\\archive.zip' },
    { ...SOURCES[0], filename: 'CON.zip' },
    { ...SOURCES[0], filename: 'archive.txt' },
    { ...SOURCES[0], filename: SOURCES[1].filename.toUpperCase() },
  ];
  for (const source of badSources) {
    assert.throws(() => validateCatalog({ schema_version: 1, sources: [source, ...SOURCES.slice(1)] }, '2024'));
  }
  for (const value of [null, [], { ...catalog(), schema_version: 2 }, { schema_version: 1 }]) {
    assert.throws(() => validateCatalog(value, 'all'));
  }
});

test('year helpers admit only the six exact numeric cuts or their string selections', () => {
  assert.deepEqual(CCPC_YEARS, [2009, 2012, 2015, 2018, 2021, 2024]);
  assert.equal(parseSelectedYear('all'), 'all');
  for (const year of CCPC_YEARS) {
    assert.equal(isCcpcYear(year), true);
    assert.equal(parseSelectedYear(String(year)), String(year));
    assert.equal(isCcpcYear(String(year)), false);
  }
  for (const value of [undefined, null, 2024, '2026', '2024.0', '02024', ' 2024', '2024 ', 'ALL']) {
    assert.throws(() => parseSelectedYear(value));
  }
  for (const value of [null, 2026, 2024.5, NaN, Infinity]) assert.equal(isCcpcYear(value), false);
});

test('acquisition matches exact year, URL, checksum and byte length', () => {
  assert.deepEqual(validateAcquisition(manifest(), SOURCE, 100), RECORD);
  for (const change of [{ year: 2018 }, { url: 'https://ine.mx/other.zip' }, { sha256: 'c'.repeat(64) }, { bytes: 101 }]) {
    assert.equal(validateAcquisition(manifest({ ...RECORD, ...change }), SOURCE, 100), null);
  }
  assert.equal(validateAcquisition({ schema_version: 1, downloads: [] }, SOURCE, 100), null);
});

test('cache provenance can keep an unknown original date and final URL', () => {
  const local = { ...RECORD, downloaded_at: null, final_url: null };
  assert.deepEqual(validateAcquisition(manifest(local), SOURCE, 100), local);
});

test('malformed dates and metadata fail even if the affected record does not match', () => {
  const changes = [
    { downloaded_at: '2026-10-12' },
    { downloaded_at: '2026-10-12T12:00:00' },
    { downloaded_at: '2026-02-30T12:00:00.000Z' },
    { downloaded_at: '2026-10-12T24:00:00.000Z' },
    { downloaded_at: '2026-10-12T12:00:00+24:00' },
    { downloaded_at: undefined },
    { verified_at: '2026-10-12' },
    { verified_at: '2026-02-30T12:00:00.000Z' },
    { verified_at: null },
    { final_url: undefined },
    { final_url: 'https://other.test/file.zip' },
    { url: 'http://ine.mx/file.zip' },
    { bytes: 3 },
    { bytes: 1.5 },
    { bytes: Number.MAX_SAFE_INTEGER + 1 },
    { sha256: 'bad' },
    { year: 2026 },
    { year: '2024' },
    { year: 2024.5 },
  ];
  for (const change of changes) {
    assert.throws(() => validateAcquisition(manifest({ ...RECORD, ...change }), SOURCES[0], 100));
  }
  for (const value of [null, [], { downloads: [RECORD] }, { schema_version: 1, downloads: {} }]) {
    assert.throws(() => validateAcquisition(value, SOURCE, 100));
  }
  assert.throws(() => validateAcquisition({ schema_version: 1, downloads: [RECORD, RECORD] }, SOURCE, 100), /duplicados/);
});

test('provenance validates every allowed year and all dates before a selected acquisition', () => {
  const records = SOURCES.map(source => ({ ...RECORD, year: source.year, url: source.url, sha256: source.sha256 }));
  const input = { schema_version: 1, downloads: records };
  assert.deepEqual(validateDownloadManifest(input), input);
  assert.deepEqual(validateAcquisition(input, SOURCE, 100), records[5]);
  records[0].verified_at = '2026-02-30T12:00:00Z';
  assert.throws(() => validateAcquisition(input, SOURCE, 100), /ISO inválida/);
});

test('real ISO dates with explicit timezones are accepted; hashes normalize to lowercase', () => {
  const record = { ...RECORD, sha256: RECORD.sha256.toUpperCase(), downloaded_at: '2024-02-29T06:00:00-06:00' };
  const acquisition = validateAcquisition(manifest(record), SOURCE, 100);
  assert.equal(acquisition?.downloaded_at, record.downloaded_at);
  assert.equal(acquisition?.sha256, RECORD.sha256);
  const upper = catalog();
  upper.sources[0].sha256 = upper.sources[0].sha256.toUpperCase();
  assert.equal(validateCatalog(upper, 'all')[0].sha256, SOURCES[0].sha256);
});
