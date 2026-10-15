import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { HEADER, selectSample, toCsv } from '../scripts/ccpc/model.ts';
import type { Row } from '../scripts/ccpc/model.ts';
import { CCPC_YEARS } from '../scripts/ccpc/years.ts';

const directory = new URL('../data/ccpc/sample/', import.meta.url);
test('fixture reducido: checksums, cobertura, claves únicas y porcentajes verificables', async () => {
  const checksum = await readFile(new URL('checksums.sha256', directory), 'utf8');
  const files = checksum.trim().split('\n');
  assert.equal(files.length, 8);
  for (const line of files) {
    const match = line.match(/^([a-f0-9]{64})  ([a-zA-Z0-9.-]+)$/);
    assert.ok(match);
    const bytes = await readFile(new URL(match[2], directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), match[1], match[2]);
  }
  const bytes = await readFile(new URL('entidad.csv', directory));
  assert.ok(bytes.length < 100_000, 'fixture debe ser pequeño');
  const rows = parse(bytes, { columns: true }) as Array<Record<string, string>>;
  const provenance = JSON.parse(await readFile(new URL('provenance.json', directory), 'utf8'));
  assert.equal(provenance.fixture.rows, rows.length);
  assert.equal(provenance.fixture.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual([...new Set(rows.map(r => r.anio))].sort(), CCPC_YEARS.map(String));
  assert.deepEqual([...new Set(rows.map(r => r.tipo_seccion))].sort(), ['mixta','rural','urbana']);
  assert.ok(rows.some(r => r.sexo === 'no_binario' && r.anio === '2024'));
  assert.ok(!rows.some(r => r.sexo === 'no_binario' && r.anio !== '2024'));
  assert.ok(rows.some(r => Number(r.NS) > 0));
  const keys = new Set<string>();
  for (const row of rows) {
    assert.deepEqual(Object.keys(row), ['entidad_clave','entidad','anio','sexo_codigo','sexo','grupo_edad','tipo_seccion','LN','SV','NV','NS','participacion_pct','abstencion_pct','no_especificado_pct','denominador_participacion']);
    assert.ok(!('SECCION' in row) && !('MPIOCVE' in row) && !('DEF' in row) && !('DEL' in row));
    const key = [row.anio,row.entidad_clave,row.sexo_codigo,row.grupo_edad,row.tipo_seccion].join('|');
    assert.ok(!keys.has(key), key); keys.add(key);
    const ln=Number(row.LN), sv=Number(row.SV), nv=Number(row.NV), ns=Number(row.NS);
    assert.equal(ln,sv+nv+ns);
    assert.equal(Number(row.denominador_participacion),sv+nv);
    for (const [field, denominator, numerator] of [['participacion_pct',sv+nv,sv],['abstencion_pct',sv+nv,nv],['no_especificado_pct',ln,ns]] as const) {
      if (denominator === 0) assert.equal(row[field],'');
      else assert.ok(Math.abs(Number(row[field])-100*numerator/denominator) <= 0.00000051, field);
    }
  }
  assert.equal(provenance.sources.length, 6);
  const catalog = JSON.parse(await readFile(new URL('../sources.json', directory), 'utf8'));
  for (const source of provenance.sources) {
    const official = catalog.sources.find((entry: any) => entry.year === source.year);
    assert.ok(official);
    assert.equal(source.archive_sha256, official.sha256);
    assert.equal(source.source_url, official.url);
    const dictionaryBytes = await readFile(new URL(`dictionary-${source.year}.txt`, directory));
    assert.equal(createHash('sha256').update(dictionaryBytes).digest('hex'), source.dictionary_sha256);
    assert.equal(source.entities.length, 32);
    assert.equal(source.members.length, 32);
    assert.ok(source.downloaded_at === null || Number.isFinite(Date.parse(source.downloaded_at)));
    if (source.download_record) {
      assert.equal(source.download_record.sha256, source.archive_sha256);
      assert.equal(source.download_record.url, source.source_url);
      assert.equal(source.download_record.downloaded_at, source.downloaded_at);
    }
    for (const result of Object.values(source.checks)) assert.equal(result,true);
  }
});

test('fixture conserva bytes al serializar sus conteos y seleccionar en orden inverso', async () => {
  const csv = await readFile(new URL('entidad.csv', directory), 'utf8');
  const parsed = parse(csv, { columns: true }) as Array<Record<string,string>>;
  const rows: Row[] = parsed.map(row => ({
    entidad_clave:row.entidad_clave, entidad:row.entidad, anio:Number(row.anio),
    sexo_codigo:Number(row.sexo_codigo), sexo:row.sexo, grupo_edad:row.grupo_edad,
    tipo_seccion:row.tipo_seccion, LN:Number(row.LN), SV:Number(row.SV), NV:Number(row.NV), NS:Number(row.NS)
  }));
  assert.equal(toCsv(selectSample([...rows].reverse())), csv);
});

test('checklist: perfil completo, nombres entre años y codificación de los 192 CSV', async () => {
  const provenance = JSON.parse(await readFile(new URL('provenance.json', directory), 'utf8'));
  for (const source of provenance.sources) {
    assert.equal(source.missing_values.rows, source.raw_rows);
    assert.deepEqual(Object.keys(source.missing_values.columns), HEADER);
    assert.equal(source.names.rows, source.raw_rows);
    assert.equal(source.names.leading_trailing_whitespace, 0);
    assert.equal(Object.keys(source.names.entity_names).length, 32);
    for (const column of HEADER) {
      const profile = source.missing_values.columns[column];
      assert.equal(profile.total_missing, profile.empty + profile.whitespace_only + profile.missing_token);
      for (const field of ['empty','whitespace_only','missing_token','total_missing'] as const) {
        assert.ok(Number.isSafeInteger(profile[field]) && profile[field] >= 0 && profile[field] <= source.raw_rows);
        const summed = source.members.reduce((sum: number, member: any) => sum + member.missing_values.columns[column][field], 0);
        assert.equal(summed, profile[field], `${source.year}.${column}.${field}: perfil por miembro conserva faltantes`);
      }
      if (source.year === 2009 && ['DEF','DEL'].includes(column)) {
        assert.equal(profile.whitespace_only, 28_477);
        assert.equal(profile.empty, 0);
      }
      if (source.year === 2024 && column === 'DEL') assert.equal(profile.empty, 20_912);
      if (source.year === 2018) assert.equal(profile.total_missing, 0);
    }
    for (const member of source.members) {
      assert.equal(member.missing_values.rows, member.rows);
      assert.equal(member.encoding.encoding, 'UTF-8');
      assert.equal(member.encoding.valid_utf8, true);
      assert.equal(member.encoding.bom, source.year === 2024);
      assert.equal(member.encoding.line_endings.cr, 0);
      assert.equal(member.encoding.line_endings[source.year === 2024 ? 'crlf' : 'lf'], member.rows + 1);
      assert.equal(member.encoding.line_endings[source.year === 2024 ? 'lf' : 'crlf'], 0);
    }
    assert.equal(source.dictionary_encoding.valid_utf8, true);
    assert.equal(source.dictionary_encoding.bom, false);
  }
  const comparison = provenance.entity_name_comparison;
  assert.equal(comparison.evaluated, true);
  assert.deepEqual(comparison.compared_years, [...CCPC_YEARS]);
  assert.deepEqual(comparison.within_year_conflicts, []);
  assert.deepEqual(comparison.changes, [{entidad_clave:'09',names_by_year:{'2009':['DISTRITO FEDERAL'],'2012':['DISTRITO FEDERAL'],'2015':['DISTRITO FEDERAL'],'2018':['DISTRITO FEDERAL'],'2021':['CIUDAD DE MEXICO'],'2024':['CIUDAD DE MEXICO']}}]);
});
