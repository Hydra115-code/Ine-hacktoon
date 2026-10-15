import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HEADER } from '../scripts/ccpc/model.ts';
import {
  createMissingProfile, observeMissing, mergeMissing,
  createNameProfile, observeEntityName, compareEntityNames, createEncodingProbe
} from '../scripts/ccpc/quality.ts';

const record = (overrides: Record<string, string> = {}): Record<string, string> =>
  ({ ...Object.fromEntries(HEADER.map(column => [column, '0'])), ...overrides });

test('dos perfiles del mismo año no acreditan una comparación entre años', () => {
  const names = createNameProfile();
  observeEntityName(names, '09', 'DISTRITO FEDERAL');
  const comparison = compareEntityNames([{year:2018,names},{year:2018,names}]);
  assert.equal(comparison.evaluated, false);
  assert.deepEqual(comparison.compared_years, [2018]);
  assert.deepEqual(comparison.changes, []);
});

test('faltantes por las 16 columnas distinguen vacíos, espacios y marcadores; cero es un valor', () => {
  const profile = createMissingProfile();
  observeMissing(profile, record({ DEL: '', EDONOM: ' \t ', NS: ' n/A ', LN: '0' }));
  assert.equal(profile.rows, 1);
  assert.deepEqual(Object.keys(profile.columns), HEADER);
  assert.deepEqual(profile.columns.DEL, { empty: 1, whitespace_only: 0, missing_token: 0, total_missing: 1 });
  assert.deepEqual(profile.columns.EDONOM, { empty: 0, whitespace_only: 1, missing_token: 0, total_missing: 1 });
  assert.deepEqual(profile.columns.NS, { empty: 0, whitespace_only: 0, missing_token: 1, total_missing: 1 });
  assert.equal(profile.columns.LN.total_missing, 0);
  for (const token of ['NULL', 'NA', 'NAN', 'NONE', 'S/D', '-']) observeMissing(profile, record({ NV: ` ${token.toLowerCase()} ` }));
  observeMissing(profile, record({ NV: 'N/A no es vacío', LN: '000', NS: 'nullify' }));
  assert.equal(profile.columns.NV.missing_token, 6);
  assert.equal(profile.rows, 8);
  assert.equal(profile.columns.LN.total_missing, 0);
});

test('perfiles combinados conservan denominadores y todas las categorías por columna', () => {
  const target = createMissingProfile();
  const source = createMissingProfile();
  observeMissing(target, record({ DEL: '' }));
  observeMissing(source, record({ DEL: ' ', SV: 'NULL' }));
  observeMissing(source, record({ DEL: '-' }));
  const snapshot = JSON.stringify(source);
  mergeMissing(target, source);
  assert.equal(target.rows, 3);
  assert.deepEqual(target.columns.DEL, { empty: 1, whitespace_only: 1, missing_token: 1, total_missing: 3 });
  assert.equal(target.columns.SV.missing_token, 1);
  assert.equal(JSON.stringify(source), snapshot);
});

test('nombres de entidad conservan variantes originales y detectan el cambio histórico de clave 09', () => {
  const oldNames = createNameProfile();
  const newNames = createNameProfile();
  observeEntityName(oldNames, '09', 'DISTRITO FEDERAL');
  observeEntityName(oldNames, '01', 'AGUASCALIENTES');
  observeEntityName(newNames, '09', 'CIUDAD DE MEXICO');
  observeEntityName(newNames, '01', 'AGUASCALIENTES');
  observeEntityName(newNames, '09', 'CIUDAD DE MEXICO');
  assert.equal(newNames.entity_names['09']['CIUDAD DE MEXICO'], 2);
  const result = compareEntityNames([{ year: 2024, names: newNames }, { year: 2018, names: oldNames }]);
  assert.deepEqual(result, {
    evaluated: true, compared_years: [2018, 2024],
    changes: [{ entidad_clave: '09', names_by_year: { '2018': ['DISTRITO FEDERAL'], '2024': ['CIUDAD DE MEXICO'] } }],
    within_year_conflicts: []
  });
  assert.equal(oldNames.entity_names['09']['DISTRITO FEDERAL'], 1);
});

test('conflictos del mismo año y espacios se reportan sin reescribir nombres', () => {
  const names = createNameProfile();
  observeEntityName(names, '10', 'DURANGO');
  observeEntityName(names, '02', 'BAJA CALIFORNIA');
  observeEntityName(names, '02', ' BAJA CALIFORNIA ');
  observeEntityName(names, '10', '__proto__');
  observeEntityName(names, '10', 'constructor');
  observeEntityName(names, '10', 'constructor');
  assert.equal(names.rows, 6);
  assert.equal(names.leading_trailing_whitespace, 1);
  assert.equal(names.entity_names['10']['__proto__'], 1);
  assert.equal(names.entity_names['10']['constructor'], 2);
  const result = compareEntityNames([{ year: 2024, names }]);
  assert.deepEqual(result, {
    evaluated: false, compared_years: [2024], changes: [],
    within_year_conflicts: [
      { year: 2024, entidad_clave: '02', names: [' BAJA CALIFORNIA ', 'BAJA CALIFORNIA'] },
      { year: 2024, entidad_clave: '10', names: ['DURANGO', '__proto__', 'constructor'] }
    ]
  });
  assert.deepEqual(compareEntityNames([]), { evaluated: false, compared_years: [], changes: [], within_year_conflicts: [] });
});

test('comparación de nombres es determinista y registra ausencia en un año como inventario vacío', () => {
  const first = createNameProfile();
  const second = createNameProfile();
  observeEntityName(first, '10', 'DURANGO');
  observeEntityName(first, '02', 'BAJA CALIFORNIA');
  observeEntityName(second, '10', ' Durango');
  const profiles = [{ year: 2024, names: second }, { year: 2018, names: first }];
  const comparison = compareEntityNames(profiles);
  assert.deepEqual(comparison, compareEntityNames([...profiles].reverse()));
  assert.deepEqual(comparison.changes.map(change => change.entidad_clave), ['02', '10']);
  assert.deepEqual(comparison.changes[0].names_by_year['2024'], []);
});

async function inspectChunks(chunks: Buffer[]) {
  const probe = createEncodingProbe();
  const passed: Buffer[] = [];
  await pipeline(Readable.from(chunks), probe.stream, new Writable({
    write(chunk: Buffer, _encoding, callback) { passed.push(chunk); callback(); }
  }));
  return { summary: probe.result(), bytes: Buffer.concat(passed) };
}

test('UTF-8 sin BOM y LF conserva exactamente los bytes', async () => {
  const original = Buffer.from('EDONOM,DEL\nMÉXICO,\n', 'utf8');
  const result = await inspectChunks([original]);
  assert.deepEqual(result.bytes, original);
  assert.deepEqual(result.summary, {
    encoding: 'UTF-8', valid_utf8: true, bom: false, bytes: original.length,
    line_endings: { lf: 2, crlf: 0, cr: 0 }
  });
});

test('BOM, carácter multibyte y CRLF partidos entre bloques se validan por flujo', async () => {
  const original = Buffer.from('\uFEFFEDONOM\r\nMÉXICO\r\n', 'utf8');
  const result = await inspectChunks([...original].map(byte => Buffer.from([byte])));
  assert.deepEqual(result.bytes, original);
  assert.deepEqual(result.summary, {
    encoding: 'UTF-8', valid_utf8: true, bom: true, bytes: original.length,
    line_endings: { lf: 0, crlf: 2, cr: 0 }
  });
});

test('cuenta LF, CRLF y CR aislados incluso el CR final y no comparte objetos de resultado', async () => {
  const probe = createEncodingProbe();
  await pipeline(Readable.from([Buffer.from('a\r'), Buffer.from('\nb\rc\nd\r')]), probe.stream,
    new Writable({ write(_chunk, _encoding, callback) { callback(); } }));
  assert.deepEqual(probe.result().line_endings, { lf: 1, crlf: 1, cr: 2 });
  const summary = probe.result();
  summary.line_endings.cr = 99;
  assert.equal(probe.result().line_endings.cr, 2);
});

test('UTF-8 inválido y secuencias incompletas al cierre fallan sin producir verificación', async () => {
  for (const chunks of [
    [Buffer.from([0xc3, 0x28])],
    [Buffer.from('EDONOM\n'), Buffer.from([0xe2]), Buffer.from([0x82])],
    [Buffer.from([0xef]), Buffer.from([0xbb])]
  ]) {
    const probe = createEncodingProbe();
    await assert.rejects(pipeline(Readable.from(chunks), probe.stream,
      new Writable({ write(_chunk, _encoding, callback) { callback(); } })), /UTF-8/);
    assert.throws(() => probe.result(), /finalizar correctamente/);
  }
});

test('no se declara verificación antes del cierre; flujo vacío es UTF-8 válido sin BOM', async () => {
  const probe = createEncodingProbe();
  assert.throws(() => probe.result(), /finalizar correctamente/);
  const result = await inspectChunks([]);
  assert.deepEqual(result.summary, {
    encoding: 'UTF-8', valid_utf8: true, bom: false, bytes: 0,
    line_endings: { lf: 0, crlf: 0, cr: 0 }
  });
});
